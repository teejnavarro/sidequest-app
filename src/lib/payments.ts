import "server-only";
import { and, asc, desc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { payment, paymentAccount, trip, tripMember } from "@/db/trip-schema";
import { getBalancesForMember } from "@/lib/costs";
import { firstNameOf } from "@/lib/display-name";
import { isMemberOf } from "@/lib/ideas";
import type { PaymentAccountInput, PaymentMethod } from "@/lib/payment-input";

// The privacy layer for payment details and recorded payments, next to costs.ts. Same rules:
// every function checks the person's rights inside its own database query, so a stranger can
// never get a row or change one. Nothing here ever returns an email address, and no pathname
// of a stored image ever leaves this file (callers get "has a QR" / "has a receipt", and the
// image routes ask getQrForViewer / getReceiptForParty).
//
// Payment details (an account) belong to one person. Only that person changes them. They are
// shown to the owner and to anyone who is in a trip with the owner right now: both people have
// a trip_member row with left_at null in the same trip. Leaving or being removed ends that at
// once. A recorded payment is between two spots; only the payer or the receiver (a person who
// is still in the trip) can read its receipt, open it or delete it.

const MAX_ACCOUNTS = 10;

// True when the viewer and the owner (a column or value) are in a trip together right now.
// Used inside the queries below, never on its own.
function sharesTripWith(viewerId: string, ownerColumn: unknown) {
  const mine = alias(tripMember, "mine");
  const theirs = alias(tripMember, "theirs");
  return exists(
    db
      .select({ one: mine.id })
      .from(mine)
      .innerJoin(theirs, eq(theirs.tripId, mine.tripId))
      .where(
        and(
          eq(mine.userId, viewerId),
          isNull(mine.leftAt),
          isNull(theirs.leftAt),
          sql`${theirs.userId} = ${ownerColumn}`,
        ),
      ),
  );
}

// True when the person is the payer's or the receiver's user and still in the trip. Used on
// the payment table inside the queries below.
function isPartyOf(userId: string) {
  const spot = alias(tripMember, "party");
  const viewer = alias(tripMember, "viewer");
  return and(
    exists(
      db
        .select({ one: spot.id })
        .from(spot)
        .where(
          and(
            or(eq(spot.id, payment.fromSpot), eq(spot.id, payment.toSpot)),
            eq(spot.userId, userId),
          ),
        ),
    ),
    exists(
      db
        .select({ one: viewer.id })
        .from(viewer)
        .where(
          and(eq(viewer.tripId, payment.tripId), eq(viewer.userId, userId), isNull(viewer.leftAt)),
        ),
    ),
  );
}

// ---- Payment details ----

export type PaymentAccountView = {
  id: string;
  kind: "gcash" | "maya" | "bank";
  bankName: string | null;
  accountName: string;
  number: string; // digits only; the full number, because the payer copies it
  hasQr: boolean;
};

const accountColumns = {
  id: paymentAccount.id,
  kind: sql<"gcash" | "maya" | "bank">`${paymentAccount.kind}`,
  bankName: paymentAccount.bankName,
  accountName: paymentAccount.accountName,
  number: paymentAccount.accountNumber,
  hasQr: sql<boolean>`${paymentAccount.qrPath} is not null`,
};

// The person's own accounts, oldest first.
export async function listMyPaymentAccounts(userId: string): Promise<PaymentAccountView[]> {
  return db
    .select(accountColumns)
    .from(paymentAccount)
    .where(eq(paymentAccount.userId, userId))
    .orderBy(asc(paymentAccount.createdAt), asc(paymentAccount.id));
}

export async function getMyPaymentAccount(
  userId: string,
  accountId: string,
): Promise<PaymentAccountView | null> {
  const rows = await db
    .select(accountColumns)
    .from(paymentAccount)
    .where(and(eq(paymentAccount.id, accountId), eq(paymentAccount.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

// Adds an account, but only while the person has fewer than 10: the count is part of the insert.
export async function createPaymentAccount(
  userId: string,
  input: PaymentAccountInput,
  qrPath: string | null,
): Promise<"ok" | "too-many"> {
  const inserted = await db
    .insert(paymentAccount)
    .select(
      db
        .select({
          id: sql<string>`gen_random_uuid()::text`.as("id"),
          userId: sql<string>`${user.id}`.as("user_id"),
          kind: sql<string>`${input.kind}::text`.as("kind"),
          bankName: sql<string | null>`${input.kind === "bank" ? input.bankName : null}::text`.as(
            "bank_name",
          ),
          accountName: sql<string>`${input.accountName}::text`.as("account_name"),
          accountNumber: sql<string>`${input.number}::text`.as("account_number"),
          qrPath: sql<string | null>`${qrPath}::text`.as("qr_path"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            sql`(select count(*) from ${paymentAccount} where ${paymentAccount.userId} = ${userId}) < ${MAX_ACCOUNTS}`,
          ),
        ),
    )
    .returning({ id: paymentAccount.id });
  return inserted.length > 0 ? "ok" : "too-many";
}

export type QrChange = { mode: "keep" } | { mode: "replace"; path: string } | { mode: "remove" };

// Changes one of the person's own accounts. `oldQrPath` is the file that is no longer used (the
// QR was replaced or removed), so the caller can delete it after the update worked.
export async function updatePaymentAccount(
  userId: string,
  accountId: string,
  input: PaymentAccountInput,
  qr: QrChange,
): Promise<{ oldQrPath: string | null } | "not-found"> {
  const before = db
    .select({ id: paymentAccount.id, qrPath: paymentAccount.qrPath })
    .from(paymentAccount)
    .where(and(eq(paymentAccount.id, accountId), eq(paymentAccount.userId, userId)))
    .as("before");
  const qrPath =
    qr.mode === "keep" ? sql`${paymentAccount.qrPath}` : qr.mode === "replace" ? qr.path : null;
  const updated = await db
    .update(paymentAccount)
    .set({
      kind: input.kind,
      bankName: input.kind === "bank" ? input.bankName : null,
      accountName: input.accountName,
      accountNumber: input.number,
      qrPath,
    })
    .from(before)
    .where(and(eq(paymentAccount.id, before.id), eq(paymentAccount.userId, userId)))
    .returning({ oldQrPath: before.qrPath });
  if (updated.length === 0) return "not-found";
  return { oldQrPath: qr.mode === "keep" ? null : updated[0]!.oldQrPath };
}

// Deletes one of the person's own accounts; `qrPath` is the file to delete afterwards.
export async function deletePaymentAccount(
  userId: string,
  accountId: string,
): Promise<{ qrPath: string | null } | "not-found"> {
  const deleted = await db
    .delete(paymentAccount)
    .where(and(eq(paymentAccount.id, accountId), eq(paymentAccount.userId, userId)))
    .returning({ qrPath: paymentAccount.qrPath });
  return deleted[0] ?? "not-found";
}

// The owner's accounts as the viewer may see them: all of them for the owner, and for anyone
// in a trip with the owner right now. Everyone else gets an empty list.
export async function listPaymentAccountsForViewer(
  ownerUserId: string,
  viewerId: string,
): Promise<PaymentAccountView[]> {
  return db
    .select(accountColumns)
    .from(paymentAccount)
    .where(
      and(
        eq(paymentAccount.userId, ownerUserId),
        or(eq(paymentAccount.userId, viewerId), sharesTripWith(viewerId, paymentAccount.userId)),
      ),
    )
    .orderBy(asc(paymentAccount.createdAt), asc(paymentAccount.id));
}

// The QR file of an account, only under the same rule. Null for anyone else or no QR.
export async function getQrForViewer(accountId: string, viewerId: string): Promise<string | null> {
  const rows = await db
    .select({ qrPath: paymentAccount.qrPath })
    .from(paymentAccount)
    .where(
      and(
        eq(paymentAccount.id, accountId),
        or(eq(paymentAccount.userId, viewerId), sharesTripWith(viewerId, paymentAccount.userId)),
      ),
    )
    .limit(1);
  return rows[0]?.qrPath ?? null;
}

// ---- Payments ----

export type PaymentPerson = {
  spotId: string;
  name: string; // first name
  isGuest: boolean;
  hasLeft: boolean;
  isYou: boolean;
};

export type PayPage = {
  currency: string;
  from: PaymentPerson;
  to: PaymentPerson;
  amount: number; // what `from` owes `to` right now, minor units; 0 when there is no such line
  canRecord: boolean; // the viewer is the payer or the receiver
  // The receiver's details, or why there are none.
  receiver: { accounts: PaymentAccountView[] } | { reason: "guest" | "left" | "none" };
};

// Everything the Pay page needs, only for a member of the trip and only when both spots are in
// the trip. The line's amount comes from fresh balances.
export async function getPayPageForMember(
  tripId: string,
  fromSpot: string,
  toSpot: string,
  userId: string,
): Promise<PayPage | null> {
  if (fromSpot === toSpot) return null;
  const rows = await db
    .select({
      spotId: tripMember.id,
      userId: tripMember.userId,
      name: sql<string>`coalesce(${user.name}, ${tripMember.guestName})`,
      isGuest: sql<boolean>`${tripMember.userId} is null`,
      hasLeft: sql<boolean>`${tripMember.leftAt} is not null`,
      currency: trip.currency,
    })
    .from(tripMember)
    .innerJoin(trip, eq(trip.id, tripMember.tripId))
    .leftJoin(user, eq(user.id, tripMember.userId))
    .where(
      and(
        eq(tripMember.tripId, tripId),
        sql`${tripMember.id} in (${fromSpot}, ${toSpot})`,
        isMemberOf(tripId, userId),
      ),
    );
  const from = rows.find((row) => row.spotId === fromSpot);
  const to = rows.find((row) => row.spotId === toSpot);
  if (!from || !to) return null;

  const person = (row: typeof from): PaymentPerson => ({
    spotId: row.spotId,
    name: firstNameOf(row.name),
    isGuest: row.isGuest,
    hasLeft: row.hasLeft,
    isYou: row.userId === userId,
  });

  const balances = await getBalancesForMember(tripId, userId);
  const line = balances.payments.find((p) => p.from === fromSpot && p.to === toSpot);

  let receiver: PayPage["receiver"];
  if (to.userId === null) receiver = { reason: "guest" };
  else if (to.hasLeft) receiver = { reason: "left" };
  else {
    const accounts = await listPaymentAccountsForViewer(to.userId, userId);
    receiver = accounts.length > 0 ? { accounts } : { reason: "none" };
  }

  return {
    currency: from.currency,
    from: person(from),
    to: person(to),
    amount: line?.amount ?? 0,
    canRecord: from.userId === userId || to.userId === userId,
    receiver,
  };
}

// Saves a payment. One insert-select: the person is in the trip, both spots are in the trip, the
// person is the user of one of them, and the currency is the trip's. `ok` saved it, `repeat` is
// the same form sent twice (the id is already this person's payment in this trip), `not-allowed`
// is everything else. The amount cap is the action's job, from fresh balances just before.
export async function recordPayment(args: {
  tripId: string;
  paymentId: string;
  fromSpot: string;
  toSpot: string;
  amount: number;
  method: PaymentMethod;
  receiptPath: string | null;
  userId: string;
}): Promise<"ok" | "repeat" | "not-allowed"> {
  const { tripId, paymentId, fromSpot, toSpot, amount, method, receiptPath, userId } = args;
  const spotInTrip = (spot: string) => {
    const s = alias(tripMember, "spot_in_trip");
    return exists(
      db
        .select({ one: s.id })
        .from(s)
        .where(and(eq(s.id, spot), eq(s.tripId, trip.id))),
    );
  };
  const mine = alias(tripMember, "my_spot");
  const inserted = await db
    .insert(payment)
    .select(
      db
        .select({
          id: sql<string>`${paymentId}::text`.as("id"),
          tripId: sql<string>`${trip.id}`.as("trip_id"),
          fromSpot: sql<string>`${fromSpot}::text`.as("from_spot"),
          toSpot: sql<string>`${toSpot}::text`.as("to_spot"),
          amount: sql<number>`${amount}::bigint`.as("amount"),
          currency: sql<string>`${trip.currency}`.as("currency"),
          method: sql<string>`${method}::text`.as("method"),
          receiptPath: sql<string | null>`${receiptPath}::text`.as("receipt_path"),
          createdBy: sql<string>`${userId}::text`.as("created_by"),
          createdAt: sql<Date>`now()`.as("created_at"),
        })
        .from(trip)
        .where(
          and(
            eq(trip.id, tripId),
            isMemberOf(tripId, userId),
            sql`${fromSpot}::text <> ${toSpot}::text`,
            sql`${amount} > 0`,
            spotInTrip(fromSpot),
            spotInTrip(toSpot),
            exists(
              db
                .select({ one: mine.id })
                .from(mine)
                .where(
                  and(
                    sql`${mine.id} in (${fromSpot}, ${toSpot})`,
                    eq(mine.tripId, trip.id),
                    eq(mine.userId, userId),
                    isNull(mine.leftAt),
                  ),
                ),
            ),
          ),
        ),
    )
    .onConflictDoNothing({ target: payment.id })
    .returning({ id: payment.id });
  if (inserted.length > 0) return "ok";
  const again = await db
    .select({ id: payment.id })
    .from(payment)
    .where(and(eq(payment.id, paymentId), eq(payment.tripId, tripId), eq(payment.createdBy, userId)))
    .limit(1);
  return again.length > 0 ? "repeat" : "not-allowed";
}

export type PaymentListItem = {
  id: string;
  from: PaymentPerson;
  to: PaymentPerson;
  amount: number;
  currency: string;
  method: PaymentMethod;
  createdAt: Date;
  mine: boolean; // the viewer is the payer or the receiver
  hasReceipt: boolean; // only ever true when `mine`
};

const fromSpotAlias = alias(tripMember, "from_spot_row");
const toSpotAlias = alias(tripMember, "to_spot_row");
const fromUser = alias(user, "from_user");
const toUser = alias(user, "to_user");

type SpotRow = typeof tripMember | typeof fromSpotAlias | typeof toSpotAlias;
type UserRow = typeof user | typeof fromUser | typeof toUser;

function personColumns(userId: string, spot: SpotRow, account: UserRow) {
  return {
    spotId: spot.id,
    name: sql<string>`coalesce(${account.name}, ${spot.guestName})`,
    isGuest: sql<boolean>`${spot.userId} is null`,
    hasLeft: sql<boolean>`${spot.leftAt} is not null`,
    isYou: sql<boolean>`coalesce(${spot.userId} = ${userId}, false)`,
  };
}

function toPerson(row: {
  spotId: string;
  name: string;
  isGuest: boolean;
  hasLeft: boolean;
  isYou: boolean;
}): PaymentPerson {
  return { ...row, name: firstNameOf(row.name) };
}

// The trip's payments in the trip's currency, newest first, for any member. The receipt flag is
// true only for the payer and the receiver; a third member sees the payment but not the receipt.
export async function listPaymentsForMember(
  tripId: string,
  userId: string,
): Promise<PaymentListItem[]> {
  const rows = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: sql<PaymentMethod>`${payment.method}`,
      createdAt: payment.createdAt,
      mine: sql<boolean>`coalesce(${fromSpotAlias.userId} = ${userId} or ${toSpotAlias.userId} = ${userId}, false)`,
      receipt: sql<boolean>`${payment.receiptPath} is not null`,
      fromSpot: personColumns(userId, fromSpotAlias, fromUser),
      toSpot: personColumns(userId, toSpotAlias, toUser),
    })
    .from(payment)
    .innerJoin(trip, and(eq(trip.id, payment.tripId), eq(trip.currency, payment.currency)))
    .innerJoin(fromSpotAlias, eq(fromSpotAlias.id, payment.fromSpot))
    .innerJoin(toSpotAlias, eq(toSpotAlias.id, payment.toSpot))
    .leftJoin(fromUser, eq(fromUser.id, fromSpotAlias.userId))
    .leftJoin(toUser, eq(toUser.id, toSpotAlias.userId))
    .where(and(eq(payment.tripId, tripId), isMemberOf(tripId, userId)))
    .orderBy(desc(payment.createdAt), desc(payment.id));
  return rows.map((row) => ({
    id: row.id,
    from: toPerson(row.fromSpot),
    to: toPerson(row.toSpot),
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    createdAt: row.createdAt,
    mine: row.mine,
    hasReceipt: row.mine && row.receipt,
  }));
}

export type PaymentDetails = PaymentListItem & { recordedBy: string; hasReceipt: boolean };

// One payment in full, only for the payer or the receiver (a person still in the trip).
export async function getPaymentForParty(
  tripId: string,
  paymentId: string,
  userId: string,
): Promise<PaymentDetails | null> {
  const recorder = alias(user, "recorder");
  const rows = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      method: sql<PaymentMethod>`${payment.method}`,
      createdAt: payment.createdAt,
      receipt: sql<boolean>`${payment.receiptPath} is not null`,
      recordedBy: recorder.name,
      fromSpot: personColumns(userId, fromSpotAlias, fromUser),
      toSpot: personColumns(userId, toSpotAlias, toUser),
    })
    .from(payment)
    .innerJoin(fromSpotAlias, eq(fromSpotAlias.id, payment.fromSpot))
    .innerJoin(toSpotAlias, eq(toSpotAlias.id, payment.toSpot))
    .leftJoin(fromUser, eq(fromUser.id, fromSpotAlias.userId))
    .leftJoin(toUser, eq(toUser.id, toSpotAlias.userId))
    .innerJoin(recorder, eq(recorder.id, payment.createdBy))
    .where(and(eq(payment.id, paymentId), eq(payment.tripId, tripId), isPartyOf(userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    from: toPerson(row.fromSpot),
    to: toPerson(row.toSpot),
    amount: row.amount,
    currency: row.currency,
    method: row.method,
    createdAt: row.createdAt,
    mine: true,
    hasReceipt: row.receipt,
    recordedBy: firstNameOf(row.recordedBy),
  };
}

// The receipt file of a payment, only for the payer or the receiver. Null for anyone else.
export async function getReceiptForParty(
  tripId: string,
  paymentId: string,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ receiptPath: payment.receiptPath })
    .from(payment)
    .where(and(eq(payment.id, paymentId), eq(payment.tripId, tripId), isPartyOf(userId)))
    .limit(1);
  return rows[0]?.receiptPath ?? null;
}

// Deletes a payment, only for the payer or the receiver; `receiptPath` is the file to delete
// afterwards. Balances are worked out fresh, so they return to what they were.
export async function deletePayment(
  tripId: string,
  paymentId: string,
  userId: string,
): Promise<{ receiptPath: string | null } | "not-found"> {
  const deleted = await db
    .delete(payment)
    .where(and(eq(payment.id, paymentId), eq(payment.tripId, tripId), isPartyOf(userId)))
    .returning({ receiptPath: payment.receiptPath });
  return deleted[0] ?? "not-found";
}
