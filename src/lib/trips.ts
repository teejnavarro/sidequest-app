import "server-only";
import { and, asc, desc, eq, exists, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { cost, costShare, trip, tripMember } from "@/db/trip-schema";
import { isMemberOf } from "@/lib/ideas";
import { isInviteCode } from "@/lib/invite-code";
import type { TripInput } from "@/lib/trip-input";

// The one door to trip data. Every function here checks that the person is a member
// of the trip inside the same database query, so a stranger can never get a row.
// Pages and actions must not query the trip tables any other way. Nothing returned
// here ever includes an email address.
//
// The one other way in is a trip's invite code (in the invite link). The code is a secret
// key: only members can read it (getInviteCodeForMember), and a visitor holding it can see
// just the trip's public details and join (getTripByInviteCode, joinTripByInviteCode).
// The list and detail functions never return the code.
//
// A trip's people are "spots" (trip_member rows): a signed-in person or a guest who has no
// account yet. Membership always means a row whose user_id is the person, so a guest never
// counts as a member. Queries that list people left-join the user table so guests show up.

export type TripMemberSummary = {
  // The user id for a person (Face colors stay the same after a guest claims their spot),
  // the spot id for a guest.
  id: string;
  spotId: string;
  name: string; // the account name for a person, the guest name for a guest
  image: string | null;
  isGuest: boolean;
  addedById: string | null;
  addedByName: string | null;
  // True for a person who left or was removed. Only costs list them (listCostPeople).
  hasLeft: boolean;
};

// A spot of someone still in the trip. A person who left keeps their row (costs point at
// it) but loses all access, so every membership check also asks for this.
const activeSpot = isNull(tripMember.leftAt);

const adder = alias(user, "adder");

// One person or guest per row. Needs tripMember left-joined to user and to the adder alias.
const memberColumns = {
  id: sql<string>`coalesce(${user.id}, ${tripMember.id})`,
  spotId: tripMember.id,
  name: sql<string>`coalesce(${user.name}, ${tripMember.guestName})`,
  image: user.image,
  isGuest: sql<boolean>`${tripMember.userId} is null`,
  addedById: tripMember.addedBy,
  addedByName: adder.name,
  hasLeft: sql<boolean>`${tripMember.leftAt} is not null`,
};

export type TripSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  currency: string;
  destination: string | null;
};

export type TripDetails = TripSummary & {
  ownerId: string;
  ownerName: string;
  ownerImage: string | null;
};

export type TripListItem = TripSummary & { members: TripMemberSummary[] };

// Every trip the person belongs to, newest first, each with the people and guests in it (id,
// name, photo, never email; oldest spot first). Two queries in total, not one per trip: the
// second only asks about trips the first one found, and those are the person's own.
export async function listMyTrips(userId: string): Promise<TripListItem[]> {
  const trips = await db
    .select({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timeZone: trip.timeZone,
      currency: trip.currency,
      destination: trip.destination,
    })
    .from(trip)
    .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
    .where(and(eq(tripMember.userId, userId), activeSpot))
    .orderBy(desc(trip.createdAt));
  if (trips.length === 0) return [];

  const people = await db
    .select({ tripId: tripMember.tripId, ...memberColumns })
    .from(tripMember)
    .leftJoin(user, eq(user.id, tripMember.userId))
    .leftJoin(adder, eq(adder.id, tripMember.addedBy))
    .where(and(inArray(tripMember.tripId, trips.map((row) => row.id)), activeSpot))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));

  const byTrip = new Map<string, TripMemberSummary[]>();
  for (const { tripId, ...member } of people) {
    byTrip.set(tripId, [...(byTrip.get(tripId) ?? []), member]);
  }
  return trips.map((row) => ({ ...row, members: byTrip.get(row.id) ?? [] }));
}

// The trip plus its owner's name and photo, or null when it does not exist or the
// person is not a member. The two cases look the same on purpose.
export async function getTripForMember(
  tripId: string,
  userId: string,
): Promise<TripDetails | null> {
  const rows = await db
    .select({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timeZone: trip.timeZone,
      currency: trip.currency,
      destination: trip.destination,
      ownerId: trip.ownerId,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(trip)
    .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
    .innerJoin(user, eq(user.id, trip.ownerId))
    .where(and(eq(trip.id, tripId), eq(tripMember.userId, userId), activeSpot))
    .limit(1);
  return rows[0] ?? null;
}

// Saves the trip and its owner's member row together: both or neither.
// (neon-http has no interactive transactions, so this uses one batch.)
export async function createTrip(userId: string, input: TripInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(trip).values({
      id,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      timeZone: input.timeZone,
      currency: input.currency,
      destination: input.destination,
      ownerId: userId,
    }),
    db.insert(tripMember).values({ tripId: id, userId }),
  ]);
  return id;
}

// Changes the trip's details. Membership is part of the update's own condition, so a
// non-member changes nothing. Returns false when nothing was changed. Never touches ownerId.
export async function updateTripForMember(
  tripId: string,
  userId: string,
  input: TripInput,
): Promise<boolean> {
  const updated = await db
    .update(trip)
    .set({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      timeZone: input.timeZone,
      currency: input.currency,
      destination: input.destination,
    })
    .where(
      and(
        eq(trip.id, tripId),
        exists(
          db
            .select({ one: tripMember.userId })
            .from(tripMember)
            .where(and(eq(tripMember.tripId, trip.id), eq(tripMember.userId, userId), activeSpot)),
        ),
      ),
    )
    .returning({ id: trip.id });
  return updated.length > 0;
}


// The invite code of a trip, but only for a member. Anyone else gets null.
export async function getInviteCodeForMember(
  tripId: string,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ inviteCode: trip.inviteCode })
    .from(trip)
    .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
    .where(and(eq(trip.id, tripId), eq(tripMember.userId, userId), activeSpot))
    .limit(1);
  return rows[0]?.inviteCode ?? null;
}

// Who is in the trip, guests included, oldest spot first: id, name and photo, never email. A
// person who is not a member gets an empty list, because the membership check is in the same
// query.
export async function listTripMembers(
  tripId: string,
  userId: string,
): Promise<TripMemberSummary[]> {
  return db
    .select(memberColumns)
    .from(tripMember)
    .leftJoin(user, eq(user.id, tripMember.userId))
    .leftJoin(adder, eq(adder.id, tripMember.addedBy))
    .where(and(eq(tripMember.tripId, tripId), activeSpot, isMemberOf(tripId, userId)))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
}

export type InvitedTrip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  destination: string | null;
  ownerName: string;
  members: TripMemberSummary[];
};

// What the invite code opens: the trip's name, destination, dates and owner's name, plus
// who is going, guests included (id, name, photo). The owner chose to show this to a visitor before sign-in;
// pages must not print members' names to a signed-out visitor. Never email, never the code.
export async function getTripByInviteCode(code: string): Promise<InvitedTrip | null> {
  if (!isInviteCode(code)) return null;
  const rows = await db
    .select({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      destination: trip.destination,
      ownerName: user.name,
    })
    .from(trip)
    .innerJoin(user, eq(user.id, trip.ownerId))
    .where(eq(trip.inviteCode, code.toLowerCase()))
    .limit(1);
  const found = rows[0];
  if (!found) return null;

  const members = await db
    .select(memberColumns)
    .from(tripMember)
    .leftJoin(user, eq(user.id, tripMember.userId))
    .leftJoin(adder, eq(adder.id, tripMember.addedBy))
    .where(and(eq(tripMember.tripId, found.id), activeSpot))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
  return { ...found, members };
}

export async function isTripMember(tripId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ one: tripMember.userId })
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId), activeSpot))
    .limit(1);
  return rows.length > 0;
}

// Postgres code for "a unique index said no". The driver may wrap the error, so look one level in.
function isUniqueViolation(error: unknown): boolean {
  const codeOf = (e: unknown) =>
    typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return codeOf(error) === "23505" || codeOf((error as { cause?: unknown } | null)?.cause) === "23505";
}

// Postgres code for "a foreign key said no".
function isForeignKeyViolation(error: unknown): boolean {
  const codeOf = (e: unknown) =>
    typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return codeOf(error) === "23503" || codeOf((error as { cause?: unknown } | null)?.cause) === "23503";
}

// May this person change a guest: they added the guest, or they own the trip.
function mayChangeGuest(userId: string) {
  return or(
    eq(tripMember.addedBy, userId),
    exists(
      db
        .select({ one: trip.id })
        .from(trip)
        .where(and(eq(trip.id, tripMember.tripId), eq(trip.ownerId, userId))),
    ),
  );
}

// The spot is still a guest in this trip, and the person is a member who may change it.
function guestEditableBy(tripId: string, spotId: string, userId: string) {
  return and(
    eq(tripMember.id, spotId),
    eq(tripMember.tripId, tripId),
    isNull(tripMember.userId),
    isMemberOf(tripId, userId),
    mayChangeGuest(userId),
  );
}

export type GuestSpot = {
  spotId: string;
  name: string;
  addedById: string;
  addedByName: string;
  costCount: number; // how many costs the guest paid or shares
};

// How many costs a spot paid or shares. Used inside queries on trip_member.
const costCountOf = sql<number>`(select count(*) from ${cost} where ${cost.paidBy} = ${tripMember.id} or exists (select 1 from ${costShare} where ${costShare.costId} = ${cost.id} and ${costShare.spotId} = ${tripMember.id}))`.mapWith(
  Number,
);

// Adds a guest (a name, no account) to the trip, but only if the person is a member: the
// insert reads the trip and checks that in the same statement. "duplicate" means another
// guest in the trip already has the name, ignoring capitals (the unique index decides).
export async function addGuest(
  tripId: string,
  userId: string,
  name: string,
): Promise<"ok" | "duplicate" | "not-found"> {
  try {
    const inserted = await db
      .insert(tripMember)
      .select(
        db
          .select({
            id: sql<string>`gen_random_uuid()::text`.as("id"),
            tripId: sql<string>`${trip.id}`.as("trip_id"),
            userId: sql<string | null>`null::text`.as("user_id"),
            guestName: sql<string | null>`${name}::text`.as("guest_name"),
            addedBy: sql<string | null>`${userId}::text`.as("added_by"),
            joinedAt: sql<Date>`now()`.as("joined_at"),
            leftAt: sql<Date | null>`null::timestamp`.as("left_at"),
          })
          .from(trip)
          .where(and(eq(trip.id, tripId), isMemberOf(tripId, userId))),
      )
      .returning({ id: tripMember.id });
    return inserted.length > 0 ? "ok" : "not-found";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

// The guest and how many costs they are in, only while the spot is still a guest in this trip
// and the person added it or owns the trip (and is a member). Anyone else, and any other
// spot, gets null.
export async function getGuestForEditor(
  tripId: string,
  spotId: string,
  userId: string,
): Promise<GuestSpot | null> {
  const rows = await db
    .select({
      spotId: tripMember.id,
      name: sql<string>`${tripMember.guestName}`,
      addedById: user.id,
      addedByName: user.name,
      costCount: costCountOf,
    })
    .from(tripMember)
    .innerJoin(user, eq(user.id, tripMember.addedBy))
    .where(guestEditableBy(tripId, spotId, userId))
    .limit(1);
  return rows[0] ?? null;
}

// Renames a guest, with the same conditions as getGuestForEditor inside the update itself.
export async function renameGuest(
  tripId: string,
  spotId: string,
  userId: string,
  name: string,
): Promise<"ok" | "duplicate" | "not-found"> {
  try {
    const updated = await db
      .update(tripMember)
      .set({ guestName: name })
      .where(guestEditableBy(tripId, spotId, userId))
      .returning({ id: tripMember.id });
    return updated.length > 0 ? "ok" : "not-found";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

// Removes a guest, with the same conditions as getGuestForEditor inside the delete itself,
// plus "the guest is not in any cost" (the database refuses it too). "in-costs" means the
// person may remove the guest but the guest is part of a cost; "not-found" covers everything
// else, so the cases look the same to a stranger.
export async function removeGuest(
  tripId: string,
  spotId: string,
  userId: string,
): Promise<"ok" | "in-costs" | "not-found"> {
  try {
    const deleted = await db
      .delete(tripMember)
      .where(and(guestEditableBy(tripId, spotId, userId), sql`${costCountOf} = 0`))
      .returning({ id: tripMember.id });
    if (deleted.length > 0) return "ok";
  } catch (error) {
    // A cost was added between the check and the delete: the foreign key said no.
    if (!isForeignKeyViolation(error)) throw error;
    return "in-costs";
  }
  const guest = await getGuestForEditor(tripId, spotId, userId);
  return guest && guest.costCount > 0 ? "in-costs" : "not-found";
}

// The guests nobody has claimed yet in the trip this code opens: spot id and name. Only
// the signed-in join page may call this, so a signed-out visitor never sees a guest's name.
export async function listUnclaimedGuestsByInviteCode(
  code: string,
): Promise<{ id: string; name: string }[]> {
  if (!isInviteCode(code)) return [];
  return db
    .select({ id: tripMember.id, name: sql<string>`${tripMember.guestName}` })
    .from(tripMember)
    .innerJoin(trip, eq(trip.id, tripMember.tripId))
    .where(and(eq(trip.inviteCode, code.toLowerCase()), isNull(tripMember.userId)))
    .orderBy(asc(tripMember.joinedAt), asc(tripMember.id));
}

// Adds the person to the trip that owns this code, or takes over a guest's spot, and returns
// the trip id. Null when the code opens nothing, "taken" when the chosen spot was just
// claimed or removed. Joining twice changes nothing. Only the join action calls this, never
// a page load, so link previews and prefetching can't add anyone.
//
// Claiming is one UPDATE on the guest's row: the spot keeps its id and its place in the
// list. neon-http has no transactions, so it must stay one statement. The WHERE makes sure
// the spot is in this code's trip, is still a guest, and the person is not in the trip yet.
export async function joinTripByInviteCode(
  code: string,
  userId: string,
  claimSpotId: string | null = null,
): Promise<{ tripId: string } | "taken" | null> {
  if (!isInviteCode(code)) return null;
  const found = await db
    .select({ id: trip.id })
    .from(trip)
    .where(eq(trip.inviteCode, code.toLowerCase()))
    .limit(1);
  const tripId = found[0]?.id;
  if (!tripId) return null;

  if (!claimSpotId) {
    await db.insert(tripMember).values({ tripId, userId }).onConflictDoNothing();
    return { tripId };
  }

  const viewer = alias(tripMember, "viewer");
  // A unique-index clash means the person's own join from another tab landed first: treat
  // it like joining twice (the check below finds them in the trip).
  const claimed = await db
    .update(tripMember)
    .set({ userId, guestName: null, addedBy: null })
    .where(
      and(
        eq(tripMember.id, claimSpotId),
        eq(tripMember.tripId, tripId),
        isNull(tripMember.userId),
        notExists(
          db
            .select({ one: viewer.userId })
            .from(viewer)
            .where(and(eq(viewer.tripId, tripId), eq(viewer.userId, userId))),
        ),
      ),
    )
    .returning({ id: tripMember.id })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) return [];
      throw error;
    });
  if (claimed.length > 0) return { tripId };
  // Nothing changed: either the person is already in the trip (fine, same as joining twice)
  // or the spot is gone.
  return (await isTripMember(tripId, userId)) ? { tripId } : "taken";
}

// Deletes the trip for good, but only for its owner. Ownership is part of each delete's own
// condition, so a member or a stranger deletes nothing. The trip's costs are deleted first,
// in the same all-or-nothing batch: a cost points at spots with no cascade, and the database
// checks that before the trip's own cascade has cleared the shares. The member rows, the
// shares and the invite code (which lives on the trip) go with the trip. Returns true only
// when a trip was removed, so repeating the delete is harmless.
export async function deleteTripForOwner(tripId: string, userId: string): Promise<boolean> {
  const owned = and(eq(trip.id, tripId), eq(trip.ownerId, userId));
  const [, deleted] = await db.batch([
    db
      .delete(cost)
      .where(and(eq(cost.tripId, tripId), exists(db.select({ one: trip.id }).from(trip).where(owned)))),
    db.delete(trip).where(owned).returning({ id: trip.id }),
  ]);
  return deleted.length > 0;
}
