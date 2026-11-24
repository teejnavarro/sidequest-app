import "server-only";
import { and, asc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { paymentAccount, tripMember } from "@/db/trip-schema";
import type { PaymentAccountInput } from "@/lib/payment-input";

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
