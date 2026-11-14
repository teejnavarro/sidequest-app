import "server-only";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { cost, costShare, trip, tripMember } from "@/db/trip-schema";
import { firstNameOf } from "@/lib/display-name";
import { isMemberOf } from "@/lib/ideas";
import type { CostInput } from "@/lib/cost-input";

// The privacy layer for shared costs, next to trips.ts and ideas.ts. Same rules: every
// function checks that the person is a member of the trip inside the same database query, so
// a stranger can never get a row or change one. Any member may edit or delete any cost.
// Costs and shares point at spots (trip_member.id), never at user ids, so a guest who later
// claims their spot keeps every cost. Nothing here ever returns an email address. Pages and
// actions must not query the cost tables any other way.
//
// A cost and its shares are written together with db.batch (one transaction on neon-http).
// The share statements only act on a cost this same transaction just wrote: `now()` is the
// transaction's start time, which is exactly the created_at / updated_at the cost got.

export type CostListItem = {
  id: string;
  description: string;
  amount: number; // minor units of `currency`
  currency: string;
  category: string | null;
  spentOn: string; // "YYYY-MM-DD"
  payer: { spotId: string; name: string; isGuest: boolean; isYou: boolean; hasLeft: boolean };
  shareCount: number;
  myShare: number | null; // the viewer's own share, or null when they are not in it
  addedBy: string; // first name
  editedBy: string | null; // first name of the last editor, only when it is someone else
};

export type CostList = { costs: CostListItem[]; total: number };

export type CostDetails = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  spentOn: string;
  paidBy: string; // a spot id
  shares: { spotId: string; amount: number }[]; // in the trip's list order
  updatedAt: Date;
};

const payerSpot = alias(tripMember, "payer_spot");
const payerUser = alias(user, "payer_user");
const creator = alias(user, "creator");
const editor = alias(user, "editor");

// All of these spots are in this trip: the count of matching rows equals the count asked for.
// A person who left only counts when they already paid or share the cost being edited
// (`costId`); a new cost (null) can't use them.
function spotsInTrip(tripId: string, spotIds: string[], costId: string | null) {
  const allowed =
    costId === null
      ? sql`${tripMember.leftAt} is null`
      : sql`(${tripMember.leftAt} is null or ${tripMember.id} in (select ${cost.paidBy} from ${cost} where ${cost.id} = ${costId} union select ${costShare.spotId} from ${costShare} where ${costShare.costId} = ${costId}))`;
  return sql`(select count(*) from ${tripMember} where ${tripMember.tripId} = ${tripId} and ${inArray(tripMember.id, spotIds)} and ${allowed}) = ${spotIds.length}`;
}

function spotsOf(input: CostInput): string[] {
  return [...new Set([input.paidBy, ...input.shares.map((share) => share.spotId)])];
}

// The trip's costs, newest day first and then newest logged, each with who paid, how many
// share it, the viewer's own share, and who added and last edited it (first names). Plus the
// total of all of them. A person who is not in the trip gets nothing.
export async function listCostsForMember(tripId: string, userId: string): Promise<CostList> {
  const rows = await db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      category: cost.category,
      spentOn: cost.spentOn,
      payerSpotId: payerSpot.id,
      payerName: sql<string>`coalesce(${payerUser.name}, ${payerSpot.guestName})`,
      payerIsGuest: sql<boolean>`${payerSpot.userId} is null`,
      payerIsYou: sql<boolean>`coalesce(${payerSpot.userId} = ${userId}, false)`,
      payerHasLeft: sql<boolean>`${payerSpot.leftAt} is not null`,
      shareCount: sql<number>`(select count(*) from ${costShare} where ${costShare.costId} = ${cost.id})`.mapWith(
        Number,
      ),
      myShare: sql<number | null>`(select ${costShare.amount} from ${costShare} inner join ${tripMember} on ${tripMember.id} = ${costShare.spotId} where ${costShare.costId} = ${cost.id} and ${tripMember.userId} = ${userId})`.mapWith(
        (value) => (value === null || value === undefined ? null : Number(value)),
      ),
      createdById: creator.id,
      createdByName: creator.name,
      updatedById: editor.id,
      updatedByName: editor.name,
    })
    .from(cost)
    .innerJoin(payerSpot, eq(payerSpot.id, cost.paidBy))
    .leftJoin(payerUser, eq(payerUser.id, payerSpot.userId))
    .innerJoin(creator, eq(creator.id, cost.createdBy))
    .innerJoin(editor, eq(editor.id, cost.updatedBy))
    .where(and(eq(cost.tripId, tripId), isMemberOf(tripId, userId)))
    .orderBy(desc(cost.spentOn), desc(cost.createdAt), desc(cost.id));

  const costs = rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    spentOn: row.spentOn,
    payer: {
      spotId: row.payerSpotId,
      name: row.payerName,
      isGuest: row.payerIsGuest,
      isYou: row.payerIsYou,
      hasLeft: row.payerHasLeft,
    },
    shareCount: row.shareCount,
    myShare: row.myShare,
    addedBy: firstNameOf(row.createdByName),
    editedBy: row.updatedById === row.createdById ? null : firstNameOf(row.updatedByName),
  }));
  return { costs, total: costs.reduce((sum, item) => sum + item.amount, 0) };
}

// One cost with its shares and when it was last saved, or null when it does not exist,
// belongs to another trip, or the person is not in this trip. The cases look the same.
export async function getCostForMember(
  tripId: string,
  costId: string,
  userId: string,
): Promise<CostDetails | null> {
  const found = and(eq(cost.id, costId), eq(cost.tripId, tripId), isMemberOf(tripId, userId));
  const rows = await db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      category: cost.category,
      spentOn: cost.spentOn,
      paidBy: cost.paidBy,
      updatedAt: cost.updatedAt,
    })
    .from(cost)
    .where(found)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const shares = await db
    .select({ spotId: costShare.spotId, amount: costShare.amount })
    .from(costShare)
    .innerJoin(cost, eq(cost.id, costShare.costId))
    .innerJoin(tripMember, eq(tripMember.id, costShare.spotId))
    .where(and(eq(costShare.costId, costId), found))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
  return { ...row, shares };
}

// Adds a cost and its shares, only if the person is in the trip and every spot in it belongs
// to the trip. The id is made by the form, so a double tap saves once: an id that is already
// there (made by this person in this trip) changes nothing and counts as "ok". The currency
// is the trip's currency as it is now.
export async function createCost(
  tripId: string,
  userId: string,
  id: string,
  input: CostInput,
): Promise<"ok" | "not-found"> {
  const insertCost = db
    .insert(cost)
    .select(
      db
        .select({
          id: sql<string>`${id}::text`.as("id"),
          tripId: sql<string>`${trip.id}`.as("trip_id"),
          description: sql<string>`${input.description}::text`.as("description"),
          amount: sql<number>`${input.amount}::bigint`.as("amount"),
          currency: sql<string>`${trip.currency}`.as("currency"),
          paidBy: sql<string>`${input.paidBy}::text`.as("paid_by"),
          category: sql<string | null>`${input.category}::text`.as("category"),
          spentOn: sql<string>`${input.spentOn}::date`.as("spent_on"),
          createdBy: sql<string>`${userId}::text`.as("created_by"),
          updatedBy: sql<string>`${userId}::text`.as("updated_by"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(trip)
        .where(
          and(eq(trip.id, tripId), isMemberOf(tripId, userId), spotsInTrip(tripId, spotsOf(input), null)),
        ),
    )
    .onConflictDoNothing()
    .returning({ id: cost.id });

  const justWritten = and(
    eq(cost.id, id),
    eq(cost.tripId, tripId),
    eq(cost.createdBy, userId),
    sql`${cost.createdAt} = now()`,
  );
  const insertShares = input.shares.map((share) =>
    db
      .insert(costShare)
      .select(
        db
          .select({
            costId: sql<string>`${cost.id}`.as("cost_id"),
            spotId: sql<string>`${share.spotId}::text`.as("spot_id"),
            amount: sql<number>`${share.amount}::bigint`.as("amount"),
          })
          .from(cost)
          .where(justWritten),
      )
      .onConflictDoNothing(),
  );

  const [inserted] = await db.batch([insertCost, ...insertShares]);
  if (inserted.length > 0) return "ok";

  // Nothing was added: either this is the same save again, or the person may not do this.
  const existing = await db
    .select({ id: cost.id })
    .from(cost)
    .where(
      and(eq(cost.id, id), eq(cost.tripId, tripId), eq(cost.createdBy, userId), isMemberOf(tripId, userId)),
    )
    .limit(1);
  return existing.length > 0 ? "ok" : "not-found";
}

// Changes a cost and replaces its shares, for any member, only if the cost has not been
// saved by someone else since the person opened it (`expectedUpdatedAt`, compared to the
// millisecond because that is all a Date holds). Returns "changed" when it has. The shares
// are only replaced when the cost update matched.
export async function updateCost(
  tripId: string,
  costId: string,
  userId: string,
  input: CostInput,
  expectedUpdatedAt: Date,
): Promise<"ok" | "changed" | "not-found"> {
  const mine = and(eq(cost.id, costId), eq(cost.tripId, tripId), isMemberOf(tripId, userId));
  const justSaved = and(mine, eq(cost.updatedBy, userId), sql`${cost.updatedAt} = now()`);

  const updateRow = db
    .update(cost)
    .set({
      description: input.description,
      amount: input.amount,
      paidBy: input.paidBy,
      category: input.category,
      spentOn: input.spentOn,
      updatedBy: userId,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        mine,
        spotsInTrip(tripId, spotsOf(input), costId),
        sql`date_trunc('milliseconds', ${cost.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
      ),
    )
    .returning({ id: cost.id });

  const removeShares = db
    .delete(costShare)
    .where(
      and(eq(costShare.costId, costId), exists(db.select({ one: cost.id }).from(cost).where(justSaved))),
    );
  const insertShares = input.shares.map((share) =>
    db.insert(costShare).select(
      db
        .select({
          costId: sql<string>`${cost.id}`.as("cost_id"),
          spotId: sql<string>`${share.spotId}::text`.as("spot_id"),
          amount: sql<number>`${share.amount}::bigint`.as("amount"),
        })
        .from(cost)
        .where(justSaved),
    ),
  );

  const [updated] = await db.batch([updateRow, removeShares, ...insertShares]);
  if (updated.length > 0) return "ok";

  const existing = await db.select({ id: cost.id }).from(cost).where(mine).limit(1);
  return existing.length > 0 ? "changed" : "not-found";
}

// Deletes a cost for good, for any member. Its shares go with it (the database cascades).
// Returns true only when a cost went, so repeating it is harmless.
export async function deleteCost(tripId: string, costId: string, userId: string): Promise<boolean> {
  const deleted = await db
    .delete(cost)
    .where(and(eq(cost.id, costId), eq(cost.tripId, tripId), isMemberOf(tripId, userId)))
    .returning({ id: cost.id });
  return deleted.length > 0;
}

// How many costs the trip has, for the Delete trip warning. Zero for a stranger.
export async function countCostsForTrip(tripId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(cost)
    .where(and(eq(cost.tripId, tripId), isMemberOf(tripId, userId)));
  return rows[0]?.count ?? 0;
}
