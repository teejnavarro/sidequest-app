import "server-only";
import { and, asc, desc, eq, exists, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { cost, costShare, payment, trip, tripMember } from "@/db/trip-schema";
import { firstNameOf } from "@/lib/display-name";
import { isMemberOf } from "@/lib/ideas";
import type { CostInput, CostMoney } from "@/lib/cost-input";
import { type Payment, balancesOf, settleUp } from "@/lib/balances";

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
  original: { amount: number; currency: string } | null; // minor units of its own currency
  category: string | null;
  spentOn: string; // "YYYY-MM-DD"
  payer: { spotId: string; name: string; isGuest: boolean; isYou: boolean; hasLeft: boolean };
  shareCount: number;
  myShare: number | null; // the viewer's own share, or null when they are not in it
  addedBy: string; // first name
  editedBy: string | null; // first name of the last editor, only when it is someone else
};

// The foreign-currency columns for a cost: all null for a cost in the trip's currency.
function originalColumns(money: CostMoney) {
  if (money.kind === "trip") return { amount: null, currency: null, rate: null };
  return {
    amount: money.original,
    currency: money.currency,
    rate: money.kind === "rate" ? money.rate : null,
  };
}

// What a cost was in its own currency, for showing under the trip-currency amount.
function originalOf(row: { amount: number | null; currency: string | null }) {
  return row.amount === null || row.currency === null ? null : { amount: row.amount, currency: row.currency };
}

export type CostList = { costs: CostListItem[]; total: number; trashCount: number };

export type CostDetails = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  spentOn: string;
  paidBy: string; // a spot id
  original: { amount: number; currency: string; rate: string | null } | null;
  shares: { spotId: string; amount: number; originalAmount: number | null }[]; // in the trip's list order
  updatedAt: Date;
  hasPhoto: boolean; // only whether there is one: the path never leaves this file
};

// What a save does with the cost's receipt photo: leave it, remove it, or put a new file
// (a path from putImage) in its place.
export type CostPhotoChange = "keep" | "remove" | { set: string };

const payerSpot = alias(tripMember, "payer_spot");
const payerUser = alias(user, "payer_user");
const creator = alias(user, "creator");
const editor = alias(user, "editor");
const deleter = alias(user, "deleter");
const photoUser = alias(user, "photo_user");

// A cost that is not in the trash. Every read and edit uses it; only the trash list, restore,
// the currency lock, guest/member cost counts and deleting a trip look at trashed costs.
const live = isNull(cost.deletedAt);

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
  const [rows, trashed] = await Promise.all([
    db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      originalAmount: cost.originalAmount,
      originalCurrency: cost.originalCurrency,
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
    .where(and(eq(cost.tripId, tripId), live, isMemberOf(tripId, userId)))
    .orderBy(desc(cost.spentOn), desc(cost.createdAt), desc(cost.id)),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(cost)
      .where(and(eq(cost.tripId, tripId), isNotNull(cost.deletedAt), isMemberOf(tripId, userId))),
  ]);

  const costs = rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    original: originalOf({ amount: row.originalAmount, currency: row.originalCurrency }),
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
  return { costs, total: costs.reduce((sum, item) => sum + item.amount, 0), trashCount: trashed[0]?.count ?? 0 };
}

// One cost with its shares and when it was last saved, or null when it does not exist,
// belongs to another trip, or the person is not in this trip. The cases look the same.
export async function getCostForMember(
  tripId: string,
  costId: string,
  userId: string,
): Promise<CostDetails | null> {
  const found = and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId));
  const rows = await db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      originalAmount: cost.originalAmount,
      originalCurrency: cost.originalCurrency,
      rate: cost.rate,
      category: cost.category,
      spentOn: cost.spentOn,
      paidBy: cost.paidBy,
      updatedAt: cost.updatedAt,
      hasPhoto: sql<boolean>`${cost.photoPath} is not null`,
    })
    .from(cost)
    .where(found)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const shares = await db
    .select({ spotId: costShare.spotId, amount: costShare.amount, originalAmount: costShare.originalAmount })
    .from(costShare)
    .innerJoin(cost, eq(cost.id, costShare.costId))
    .innerJoin(tripMember, eq(tripMember.id, costShare.spotId))
    .where(and(eq(costShare.costId, costId), found))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
  const { originalAmount, originalCurrency, rate, ...rest } = row;
  const original = originalOf({ amount: originalAmount, currency: originalCurrency });
  return { ...rest, original: original && { ...original, rate }, shares };
}

// One person (or guest) on a cost breakdown. `id` is the user id for a person and the spot id
// for a guest, which only colors their face. The name is a first name ("Former member" for a
// deleted account).
export type CostPerson = {
  spotId: string;
  id: string;
  name: string;
  image: string | null;
  isGuest: boolean;
  isYou: boolean;
  hasLeft: boolean;
};

export type CostBreakdown = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  spentOn: string;
  original: { amount: number; currency: string; rate: string | null } | null;
  paidBy: string; // a spot id
  payer: CostPerson;
  shares: (CostPerson & { amount: number; originalAmount: number | null })[]; // in the trip's list order
  addedBy: { name: string; isYou: boolean };
  createdAt: Date;
  editedBy: { name: string; isYou: boolean } | null; // null when the cost was never edited
  updatedAt: Date;
  // The receipt photo's adder ("you" or a first name) and time. Never the path.
  photo: { by: string; at: Date } | null;
};

// One cost for its breakdown page: who paid, each person's share, and who added and last edited
// it. Read-only. Null when it does not exist, is in the trash, belongs to another trip, or the
// person is not in this trip. Every one of those looks the same.
export async function getCostBreakdownForMember(
  tripId: string,
  costId: string,
  userId: string,
): Promise<CostBreakdown | null> {
  const found = and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId));
  const rows = await db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      originalAmount: cost.originalAmount,
      originalCurrency: cost.originalCurrency,
      rate: cost.rate,
      category: cost.category,
      spentOn: cost.spentOn,
      paidBy: cost.paidBy,
      payerUserId: payerSpot.userId,
      payerName: sql<string>`coalesce(${payerUser.name}, ${payerSpot.guestName})`,
      payerImage: payerUser.image,
      payerHasLeft: sql<boolean>`${payerSpot.leftAt} is not null`,
      createdById: creator.id,
      createdByName: creator.name,
      createdAt: cost.createdAt,
      updatedById: editor.id,
      updatedByName: editor.name,
      updatedAt: cost.updatedAt,
      hasPhoto: sql<boolean>`${cost.photoPath} is not null`,
      photoById: photoUser.id,
      photoByName: photoUser.name,
      photoAt: cost.photoAt,
    })
    .from(cost)
    .innerJoin(payerSpot, eq(payerSpot.id, cost.paidBy))
    .leftJoin(payerUser, eq(payerUser.id, payerSpot.userId))
    .innerJoin(creator, eq(creator.id, cost.createdBy))
    .innerJoin(editor, eq(editor.id, cost.updatedBy))
    .leftJoin(photoUser, eq(photoUser.id, cost.photoBy))
    .where(found)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const shareRows = await db
    .select({
      spotId: costShare.spotId,
      userId: tripMember.userId,
      name: sql<string>`coalesce(${user.name}, ${tripMember.guestName})`,
      image: user.image,
      hasLeft: sql<boolean>`${tripMember.leftAt} is not null`,
      amount: costShare.amount,
      originalAmount: costShare.originalAmount,
    })
    .from(costShare)
    .innerJoin(cost, eq(cost.id, costShare.costId))
    .innerJoin(tripMember, eq(tripMember.id, costShare.spotId))
    .leftJoin(user, eq(user.id, tripMember.userId))
    .where(and(eq(costShare.costId, costId), found))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));

  const personOf = (spot: { spotId: string; userId: string | null; name: string; image: string | null; hasLeft: boolean }) => ({
    spotId: spot.spotId,
    id: spot.userId ?? spot.spotId,
    name: firstNameOf(spot.name),
    image: spot.image,
    isGuest: spot.userId === null,
    isYou: spot.userId === userId,
    hasLeft: spot.hasLeft,
  });
  const { originalAmount, originalCurrency, rate } = row;
  const original = originalOf({ amount: originalAmount, currency: originalCurrency });
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    category: row.category,
    spentOn: row.spentOn,
    original: original && { ...original, rate },
    paidBy: row.paidBy,
    payer: personOf({
      spotId: row.paidBy,
      userId: row.payerUserId,
      name: row.payerName,
      image: row.payerImage,
      hasLeft: row.payerHasLeft,
    }),
    shares: shareRows.map((share) => ({ ...personOf(share), amount: share.amount, originalAmount: share.originalAmount })),
    addedBy: { name: firstNameOf(row.createdByName), isYou: row.createdById === userId },
    createdAt: row.createdAt,
    editedBy:
      row.updatedAt.getTime() === row.createdAt.getTime()
        ? null
        : { name: firstNameOf(row.updatedByName), isYou: row.updatedById === userId },
    updatedAt: row.updatedAt,
    photo:
      row.hasPhoto && row.photoAt
        ? { by: row.photoById === userId ? "you" : firstNameOf(row.photoByName ?? ""), at: row.photoAt }
        : null,
  };
}

// The path of a cost's receipt photo, only for a person still in the trip and only for a live
// cost in that trip. Null for everything else, which all look the same. The path is for the
// photo route to read the file with; it never goes to the browser.
export async function getCostPhotoForMember(tripId: string, costId: string, userId: string): Promise<string | null> {
  const rows = await db
    .select({ path: cost.photoPath })
    .from(cost)
    .where(and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId)))
    .limit(1);
  return rows[0]?.path ?? null;
}

// Puts a photo on a cost (a path), or takes it off (null), for any current member of the trip,
// on a live cost. One statement; `old` is the path it replaced (the subquery reads the row as
// it was before this statement), for the caller to delete. updated_at / updated_by are left
// alone on purpose: a photo is not an edit, and an open Edit form must not clash with it.
export async function setCostPhotoForMember(
  tripId: string,
  costId: string,
  userId: string,
  path: string | null,
): Promise<{ ok: true; old: string | null } | { ok: false }> {
  const rows = await db
    .update(cost)
    .set({
      photoPath: path,
      photoBy: path === null ? null : userId,
      photoAt: path === null ? null : sql`now()`,
      updatedAt: sql`${cost.updatedAt}`,
    })
    .where(and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId)))
    .returning({ old: sql<string | null>`(select old_cost.photo_path from cost old_cost where old_cost.id = ${costId})` });
  return rows.length > 0 ? { ok: true, old: rows[0]!.old ?? null } : { ok: false };
}

// The photo columns a save writes: a new file with who and when, or all empty.
function photoColumns(photo: CostPhotoChange, userId: string) {
  return typeof photo === "object"
    ? { path: photo.set, by: userId, at: sql`now()` }
    : { path: null, by: null, at: null };
}

// Adds a cost and its shares, only if the person is in the trip and every spot in it belongs
// to the trip. The id is made by the form, so a double tap saves once: an id that is already
// there (made by this person in this trip) changes nothing and counts as "ok". The currency
// is the trip's currency as it is now. "repeat" is that same save again (a photo sent with it
// was not used, so the caller deletes it). A new cost's photo is `{ set: path }` or nothing.
export async function createCost(
  tripId: string,
  userId: string,
  id: string,
  input: CostInput,
  photo: CostPhotoChange = "keep",
): Promise<"ok" | "repeat" | "not-found"> {
  const original = originalColumns(input.money);
  const photoNew = photoColumns(photo, userId);
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
          originalAmount: sql<number | null>`${original.amount}::bigint`.as("original_amount"),
          originalCurrency: sql<string | null>`${original.currency}::text`.as("original_currency"),
          rate: sql<string | null>`${original.rate}::text`.as("rate"),
          deletedAt: sql<Date | null>`null::timestamp`.as("deleted_at"),
          deletedBy: sql<string | null>`null::text`.as("deleted_by"),
          photoPath: sql<string | null>`${photoNew.path}::text`.as("photo_path"),
          photoBy: sql<string | null>`${photoNew.by}::text`.as("photo_by"),
          photoAt: sql<Date | null>`${photoNew.at}::timestamp`.as("photo_at"),
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
            originalAmount: sql<number | null>`${share.originalAmount}::bigint`.as("original_amount"),
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
  return existing.length > 0 ? "repeat" : "not-found";
}

// Changes a cost and replaces its shares, for any member, only if the cost has not been
// saved by someone else since the person opened it (`expectedUpdatedAt`, compared to the
// millisecond because that is all a Date holds). Returns "changed" when it has. The shares
// are only replaced when the cost update matched. `photo` keeps, removes or replaces the
// receipt photo in the same statement; a saved edit returns the path it replaced (null when
// there was none) so the caller can delete that file.
export async function updateCost(
  tripId: string,
  costId: string,
  userId: string,
  input: CostInput,
  expectedUpdatedAt: Date,
  photo: CostPhotoChange = "keep",
): Promise<"changed" | "not-found" | { ok: true; oldPhoto: string | null }> {
  const mine = and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId));
  const justSaved = and(mine, eq(cost.updatedBy, userId), sql`${cost.updatedAt} = now()`);

  const original = originalColumns(input.money);
  const photoUpdate = photoColumns(photo, userId);
  const updateRow = db
    .update(cost)
    .set({
      description: input.description,
      amount: input.amount,
      paidBy: input.paidBy,
      category: input.category,
      spentOn: input.spentOn,
      originalAmount: original.amount,
      originalCurrency: original.currency,
      rate: original.rate,
      updatedBy: userId,
      updatedAt: sql`now()`,
      ...(photo === "keep"
        ? {}
        : { photoPath: photoUpdate.path, photoBy: photoUpdate.by, photoAt: photoUpdate.at }),
    })
    .where(
      and(
        mine,
        spotsInTrip(tripId, spotsOf(input), costId),
        sql`date_trunc('milliseconds', ${cost.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
      ),
    )
    .returning({
      id: cost.id,
      oldPhoto: sql<string | null>`(select old_cost.photo_path from cost old_cost where old_cost.id = ${costId})`,
    });

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
          originalAmount: sql<number | null>`${share.originalAmount}::bigint`.as("original_amount"),
        })
        .from(cost)
        .where(justSaved),
    ),
  );

  const [updated] = await db.batch([updateRow, removeShares, ...insertShares]);
  if (updated.length > 0) return { ok: true, oldPhoto: updated[0]!.oldPhoto ?? null };

  const existing = await db.select({ id: cost.id }).from(cost).where(mine).limit(1);
  return existing.length > 0 ? "changed" : "not-found";
}

// Moves a cost to the trash, for any member. The shares stay, so Restore brings back exactly
// the same balances. updated_at has $onUpdate, so it is set to itself: trashing is not an edit.
// Returns true only when a cost moved, so repeating it is harmless.
export async function deleteCost(tripId: string, costId: string, userId: string): Promise<boolean> {
  const moved = await db
    .update(cost)
    .set({ deletedAt: sql`now()`, deletedBy: userId, updatedAt: sql`${cost.updatedAt}` })
    .where(and(eq(cost.id, costId), eq(cost.tripId, tripId), live, isMemberOf(tripId, userId)))
    .returning({ id: cost.id });
  return moved.length > 0;
}

// Puts a trashed cost back, for any member. True only when a cost came back.
export async function restoreCost(tripId: string, costId: string, userId: string): Promise<boolean> {
  const back = await db
    .update(cost)
    .set({ deletedAt: null, deletedBy: null, updatedAt: sql`${cost.updatedAt}` })
    .where(
      and(eq(cost.id, costId), eq(cost.tripId, tripId), isNotNull(cost.deletedAt), isMemberOf(tripId, userId)),
    )
    .returning({ id: cost.id });
  return back.length > 0;
}

export type TrashItem = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  original: { amount: number; currency: string } | null; // minor units of its own currency
  category: string | null;
  deletedAt: Date;
  deletedBy: string; // first name
  deletedByYou: boolean;
};

// The trip's trashed costs, newest deletion first. Empty for a stranger.
export async function listTrashForMember(tripId: string, userId: string): Promise<TrashItem[]> {
  const rows = await db
    .select({
      id: cost.id,
      description: cost.description,
      amount: cost.amount,
      currency: cost.currency,
      originalAmount: cost.originalAmount,
      originalCurrency: cost.originalCurrency,
      category: cost.category,
      deletedAt: cost.deletedAt,
      deletedById: deleter.id,
      deletedByName: deleter.name,
    })
    .from(cost)
    .innerJoin(deleter, eq(deleter.id, cost.deletedBy))
    .where(and(eq(cost.tripId, tripId), isNotNull(cost.deletedAt), isMemberOf(tripId, userId)))
    .orderBy(desc(cost.deletedAt), desc(cost.id));
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    original: originalOf({ amount: row.originalAmount, currency: row.originalCurrency }),
    category: row.category,
    deletedAt: row.deletedAt!, // the where clause only lets trashed costs through
    deletedBy: firstNameOf(row.deletedByName),
    deletedByYou: row.deletedById === userId,
  }));
}

// How many costs the trip has (and how many of them are in the trash), for the Delete trip
// warning. Deleting the trip deletes both. Zero for a stranger.
export async function countCostsForTrip(
  tripId: string,
  userId: string,
): Promise<{ total: number; trashed: number }> {
  const rows = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      trashed: sql<number>`count(*) filter (where ${cost.deletedAt} is not null)`.mapWith(Number),
    })
    .from(cost)
    .where(and(eq(cost.tripId, tripId), isMemberOf(tripId, userId)));
  return { total: rows[0]?.total ?? 0, trashed: rows[0]?.trashed ?? 0 };
}

export type BalancePerson = {
  spotId: string;
  id: string; // user id for a person, spot id for a guest (colors the face)
  name: string; // first name
  image: string | null;
  isGuest: boolean;
  isYou: boolean;
  hasLeft: boolean;
  net: number; // paid - share + sent - received, minor units; > 0 is owed, < 0 owes
};

export type TripBalances = {
  people: BalancePerson[];
  payments: Payment[];
  total: number; // all costs in the trip's currency
  costCount: number;
};

const NO_BALANCES: TripBalances = { people: [], payments: [], total: 0, costCount: 0 };

// Who is owed and who owes in this trip, and the fewest payments that settle it. Worked out
// fresh from the costs and shares, never stored. Only costs in the trip's current currency
// count. People still in the trip are listed, plus people who left but still have money owed
// either way. A person who is not in the trip gets nothing.
export async function getBalancesForMember(tripId: string, userId: string): Promise<TripBalances> {
  const costInTripCurrency = sql`${cost.currency} = ${trip.currency} and ${cost.deletedAt} is null`;
  const paymentInTripCurrency = sql`${payment.currency} = ${trip.currency}`;
  const [rows, totals] = await Promise.all([
    db
      .select({
        spotId: tripMember.id,
        id: sql<string>`coalesce(${tripMember.userId}, ${tripMember.id})`,
        name: sql<string>`coalesce(${user.name}, ${tripMember.guestName})`,
        image: user.image,
        isGuest: sql<boolean>`${tripMember.userId} is null`,
        isYou: sql<boolean>`coalesce(${tripMember.userId} = ${userId}, false)`,
        hasLeft: sql<boolean>`${tripMember.leftAt} is not null`,
        paid: sql<number>`(select coalesce(sum(${cost.amount}), 0) from ${cost} where ${cost.paidBy} = ${tripMember.id} and ${costInTripCurrency})`.mapWith(
          Number,
        ),
        share: sql<number>`(select coalesce(sum(${costShare.amount}), 0) from ${costShare} inner join ${cost} on ${cost.id} = ${costShare.costId} where ${costShare.spotId} = ${tripMember.id} and ${costInTripCurrency})`.mapWith(
          Number,
        ),
        // Money already paid back, in the trip's currency only (like costs).
        sent: sql<number>`(select coalesce(sum(${payment.amount}), 0) from ${payment} where ${payment.fromSpot} = ${tripMember.id} and ${paymentInTripCurrency})`.mapWith(
          Number,
        ),
        received: sql<number>`(select coalesce(sum(${payment.amount}), 0) from ${payment} where ${payment.toSpot} = ${tripMember.id} and ${paymentInTripCurrency})`.mapWith(
          Number,
        ),
      })
      .from(tripMember)
      .innerJoin(trip, eq(trip.id, tripMember.tripId))
      .leftJoin(user, eq(user.id, tripMember.userId))
      .where(and(eq(tripMember.tripId, tripId), isMemberOf(tripId, userId)))
      .orderBy(asc(tripMember.joinedAt), asc(tripMember.id)),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        total: sql<number>`coalesce(sum(${cost.amount}), 0)`.mapWith(Number),
      })
      .from(cost)
      .innerJoin(trip, eq(trip.id, cost.tripId))
      .where(and(eq(cost.tripId, tripId), costInTripCurrency, isMemberOf(tripId, userId))),
  ]);

  const balances = balancesOf(
    rows.map((row) => ({
      spotId: row.spotId,
      paid: row.paid,
      share: row.share,
      sent: row.sent,
      received: row.received,
    })),
  );
  const people = rows
    .map((row, index) => ({
      spotId: row.spotId,
      id: row.id,
      name: firstNameOf(row.name),
      image: row.image,
      isGuest: row.isGuest,
      isYou: row.isYou,
      hasLeft: row.hasLeft,
      net: balances[index]!.net,
    }))
    .filter((person) => !person.hasLeft || person.net !== 0);
  if (people.length === 0) return NO_BALANCES;
  return {
    people,
    // People who left with a zero balance are dropped above and contribute nothing here.
    payments: settleUp(people.map(({ spotId, net }) => ({ spotId, net }))),
    total: totals[0]?.total ?? 0,
    costCount: totals[0]?.count ?? 0,
  };
}

// What the New cost form starts with: the currency the viewer used last in this trip, and the
// newest rate anyone in the trip typed for it. With no live cost of theirs it is the trip's
// currency. Trashed costs are ignored. A stranger gets "" and "" (the trip's currency is not
// theirs to see).
export async function getNewCostDefaults(
  tripId: string,
  userId: string,
): Promise<{ currency: string; rate: string }> {
  const [[tripRow], [last]] = await Promise.all([
    db
      .select({ currency: trip.currency })
      .from(trip)
      .where(and(eq(trip.id, tripId), isMemberOf(tripId, userId)))
      .limit(1),
    db
      .select({ currency: sql<string>`coalesce(${cost.originalCurrency}, ${cost.currency})` })
      .from(cost)
      .where(and(eq(cost.tripId, tripId), live, eq(cost.createdBy, userId), isMemberOf(tripId, userId)))
      .orderBy(desc(cost.createdAt), desc(cost.id))
      .limit(1),
  ]);
  if (!tripRow) return { currency: "", rate: "" };
  if (!last) return { currency: tripRow.currency, rate: "" };
  const [latest] = await db
    .select({ rate: cost.rate })
    .from(cost)
    .where(
      and(
        eq(cost.tripId, tripId),
        live,
        eq(cost.originalCurrency, last.currency),
        isNotNull(cost.rate),
        isMemberOf(tripId, userId),
      ),
    )
    .orderBy(desc(cost.createdAt), desc(cost.id))
    .limit(1);
  return { currency: last.currency, rate: latest?.rate ?? "" };
}

export type ExportCost = {
  id: string;
  spentOn: string;
  description: string;
  category: string | null;
  amount: number; // trip currency, minor units
  original: { amount: number; currency: string; rate: string | null } | null;
  paidBy: string; // a spot id
  shares: Record<string, number>; // spot id -> trip-currency minor units
};

export type ExportPerson = { spotId: string; name: string; isGuest: boolean; hasLeft: boolean };

export type CostsExport = {
  tripName: string;
  currency: string;
  people: ExportPerson[]; // everyone in a live cost, in the trip's list order
  costs: ExportCost[]; // oldest first
};

// Everything the spreadsheet download needs, for a member only (null for anyone else): the
// trip's live costs, oldest first, and the people in them. Full names, never emails.
export async function listCostsForExport(tripId: string, userId: string): Promise<CostsExport | null> {
  const [tripRow] = await db
    .select({ name: trip.name, currency: trip.currency })
    .from(trip)
    .where(and(eq(trip.id, tripId), isMemberOf(tripId, userId)))
    .limit(1);
  if (!tripRow) return null;

  const [costRows, shareRows, spots] = await Promise.all([
    db
      .select({
        id: cost.id,
        spentOn: cost.spentOn,
        description: cost.description,
        category: cost.category,
        amount: cost.amount,
        originalAmount: cost.originalAmount,
        originalCurrency: cost.originalCurrency,
        rate: cost.rate,
        paidBy: cost.paidBy,
      })
      .from(cost)
      .where(and(eq(cost.tripId, tripId), live, isMemberOf(tripId, userId)))
      .orderBy(asc(cost.spentOn), asc(cost.createdAt), asc(cost.id)),
    db
      .select({ costId: costShare.costId, spotId: costShare.spotId, amount: costShare.amount })
      .from(costShare)
      .innerJoin(cost, eq(cost.id, costShare.costId))
      .where(and(eq(cost.tripId, tripId), live, isMemberOf(tripId, userId))),
    db
      .select({
        spotId: tripMember.id,
        name: sql<string>`coalesce(${user.name}, ${tripMember.guestName})`,
        isGuest: sql<boolean>`${tripMember.userId} is null`,
        hasLeft: sql<boolean>`${tripMember.leftAt} is not null`,
      })
      .from(tripMember)
      .leftJoin(user, eq(user.id, tripMember.userId))
      .where(
        and(
          eq(tripMember.tripId, tripId),
          isMemberOf(tripId, userId),
          sql`(exists (select 1 from ${cost} where ${cost.paidBy} = ${tripMember.id} and ${cost.deletedAt} is null) or exists (select 1 from ${costShare} inner join ${cost} on ${cost.id} = ${costShare.costId} where ${costShare.spotId} = ${tripMember.id} and ${cost.deletedAt} is null))`,
        ),
      )
      .orderBy(asc(tripMember.joinedAt), asc(tripMember.id)),
  ]);

  const sharesOf = new Map<string, Record<string, number>>();
  for (const share of shareRows) {
    const map = sharesOf.get(share.costId) ?? {};
    map[share.spotId] = share.amount;
    sharesOf.set(share.costId, map);
  }
  return {
    tripName: tripRow.name,
    currency: tripRow.currency,
    people: spots,
    costs: costRows.map((row) => {
      const original = originalOf({ amount: row.originalAmount, currency: row.originalCurrency });
      return {
        id: row.id,
        spentOn: row.spentOn,
        description: row.description,
        category: row.category,
        amount: row.amount,
        original: original && { ...original, rate: row.rate },
        paidBy: row.paidBy,
        shares: sharesOf.get(row.id) ?? {},
      };
    }),
  };
}
