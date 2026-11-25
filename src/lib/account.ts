import "server-only";
import { and, desc, eq, exists, inArray, isNotNull, isNull, ne, not, notExists, notInArray, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { account, session, user } from "@/db/auth-schema";
import { cost, payment, paymentAccount, trip, tripMember } from "@/db/trip-schema";
import { deleteImages } from "@/lib/blob-store";
import { getBalancesForMember } from "@/lib/costs";
import { FORMER_MEMBER_NAME } from "@/lib/display-name";

// The privacy layer for deleting an account. "Delete" blanks the account out instead of
// removing the user row: fourteen foreign keys point at it, and costs, ideas and votes must
// keep a name to show. The person's own data (photo, email, payment details, receipts they
// uploaded, sign-in links) is wiped; trips only they are in go with them.

// Another signed-in person who is still in the trip. Guests never count.
function otherActivePerson(tripIdColumn: AnyColumn, userId: string) {
  const other = alias(tripMember, "other");
  return exists(
    db
      .select({ one: other.id })
      .from(other)
      .where(
        and(
          eq(other.tripId, tripIdColumn),
          isNotNull(other.userId),
          ne(other.userId, userId),
          isNull(other.leftAt),
        ),
      ),
  );
}

// Ids of the trips the person owns, shared with someone else or only theirs.
function ownedTripIds(userId: string, shared: boolean) {
  const owned = alias(trip, "owned");
  const someoneElse = otherActivePerson(owned.id, userId);
  return db
    .select({ id: owned.id })
    .from(owned)
    .where(and(eq(owned.ownerId, userId), shared ? someoneElse : not(someoneElse)));
}

// Every write in deleteAccount carries this in its own WHERE, so a hand-back that lands at
// the same moment makes the whole batch change nothing.
const canDelete = (userId: string) => notExists(ownedTripIds(userId, true));

// The two counts below are written out in full: a single-table select leaves column names
// unqualified, so ${trip.id} inside the subquery would point at the wrong table.
export type DeletionCheck = {
  // Shared trips the person owns; peopleCount = active spots (guests and the person included).
  handOver: { tripId: string; name: string; peopleCount: number }[];
  // Trips only they are in. costCount includes trashed costs, like Delete trip.
  soloTrips: { tripId: string; name: string; costCount: number }[];
  // Still-active trips where the person's balance is negative.
  owing: { tripId: string; name: string; amount: number; currency: string }[];
};

export async function getAccountDeletionCheck(userId: string): Promise<DeletionCheck> {
  const [handOver, soloTrips, active] = await Promise.all([
    db
      .select({
        tripId: trip.id,
        name: trip.name,
        peopleCount: sql<number>`(select count(*) from trip_member where trip_member.trip_id = "trip"."id" and trip_member.left_at is null)`.mapWith(
          Number,
        ),
      })
      .from(trip)
      .where(and(eq(trip.ownerId, userId), inArray(trip.id, ownedTripIds(userId, true))))
      .orderBy(desc(trip.createdAt)),
    db
      .select({
        tripId: trip.id,
        name: trip.name,
        costCount: sql<number>`(select count(*) from cost where cost.trip_id = "trip"."id")`.mapWith(
          Number,
        ),
      })
      .from(trip)
      .where(and(eq(trip.ownerId, userId), inArray(trip.id, ownedTripIds(userId, false))))
      .orderBy(desc(trip.createdAt)),
    // Trips that stay (any role). Solo trips are going away, so they never owe anything.
    db
      .select({ tripId: trip.id, name: trip.name, currency: trip.currency })
      .from(trip)
      .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
      .where(
        and(
          eq(tripMember.userId, userId),
          isNull(tripMember.leftAt),
          notInArray(trip.id, ownedTripIds(userId, false)),
        ),
      )
      .orderBy(desc(trip.createdAt)),
  ]);
  const balances = await Promise.all(active.map((row) => getBalancesForMember(row.tripId, userId)));
  const owing = active.flatMap((row, index) => {
    const me = balances[index]!.people.find((person) => person.isYou);
    return me && me.net < 0 ? [{ ...row, amount: -me.net }] : [];
  });
  return { handOver, soloTrips, owing };
}

// Blanks the account out in one all-or-nothing batch. Statements run in order inside one
// transaction: the receipt paths are read before the rows that hold them are deleted or
// cleared. Returns "owns-shared-trips" (and changes nothing) while a shared trip is still theirs.
export async function deleteAccount(userId: string): Promise<"ok" | "owns-shared-trips"> {
  const guard = canDelete(userId);
  const inSoloTrip = inArray(payment.tripId, ownedTripIds(userId, false));
  const [qr, own, solo, , , , , , , blanked] = await db.batch([
    db
      .select({ path: paymentAccount.qrPath })
      .from(paymentAccount)
      .where(and(eq(paymentAccount.userId, userId), isNotNull(paymentAccount.qrPath), guard)),
    db
      .select({ path: payment.receiptPath })
      .from(payment)
      .where(and(eq(payment.createdBy, userId), isNotNull(payment.receiptPath), guard)),
    db
      .select({ path: payment.receiptPath })
      .from(payment)
      .where(and(inSoloTrip, isNotNull(payment.receiptPath), guard)),
    // Solo trips: payments and costs point at spots without cascade, so they go first.
    db.delete(payment).where(and(inSoloTrip, guard)),
    db
      .delete(cost)
      .where(and(inArray(cost.tripId, ownedTripIds(userId, false)), guard)),
    db.delete(trip).where(and(inArray(trip.id, ownedTripIds(userId, false)), guard)),
    db
      .update(payment)
      .set({ receiptPath: null })
      .where(and(eq(payment.createdBy, userId), guard)),
    db.delete(paymentAccount).where(and(eq(paymentAccount.userId, userId), guard)),
    db
      .update(tripMember)
      .set({ leftAt: sql`now()` })
      .where(and(eq(tripMember.userId, userId), isNull(tripMember.leftAt), guard)),
    db
      .update(user)
      .set({
        name: FORMER_MEMBER_NAME,
        email: sql`'deleted-' || ${user.id} || '@deleted.invalid'`,
        image: null,
        emailVerified: false,
      })
      .where(and(eq(user.id, userId), guard))
      .returning({ id: user.id }),
    db.delete(session).where(and(eq(session.userId, userId), guard)),
    db.delete(account).where(and(eq(account.userId, userId), guard)),
  ]);
  if (blanked.length === 0) return "owns-shared-trips";
  const paths = [...qr, ...own, ...solo].flatMap((row) => (row.path ? [row.path] : []));
  await deleteImages([...new Set(paths)]);
  return "ok";
}
