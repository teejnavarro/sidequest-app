import "server-only";
import { and, asc, desc, eq, exists, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { trip, tripMember } from "@/db/trip-schema";
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

export type TripMemberSummary = { id: string; name: string; image: string | null };

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

// Every trip the person belongs to, newest first, each with the people in it (id, name,
// photo, never email; oldest member first). Two queries in total, not one per trip: the
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
    .where(eq(tripMember.userId, userId))
    .orderBy(desc(trip.createdAt));
  if (trips.length === 0) return [];

  const people = await db
    .select({ tripId: tripMember.tripId, id: user.id, name: user.name, image: user.image })
    .from(tripMember)
    .innerJoin(user, eq(user.id, tripMember.userId))
    .where(inArray(tripMember.tripId, trips.map((row) => row.id)))
    .orderBy(asc(tripMember.joinedAt), asc(user.id));

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
    .where(and(eq(trip.id, tripId), eq(tripMember.userId, userId)))
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
            .where(and(eq(tripMember.tripId, trip.id), eq(tripMember.userId, userId))),
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
    .where(and(eq(trip.id, tripId), eq(tripMember.userId, userId)))
    .limit(1);
  return rows[0]?.inviteCode ?? null;
}

// Who is in the trip, oldest member first: id, name and photo, never email. A person who
// is not a member gets an empty list, because the membership check is in the same query.
export async function listTripMembers(
  tripId: string,
  userId: string,
): Promise<TripMemberSummary[]> {
  const viewer = alias(tripMember, "viewer");
  return db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(tripMember)
    .innerJoin(user, eq(user.id, tripMember.userId))
    .where(
      and(
        eq(tripMember.tripId, tripId),
        exists(
          db
            .select({ one: viewer.userId })
            .from(viewer)
            .where(and(eq(viewer.tripId, tripId), eq(viewer.userId, userId))),
        ),
      ),
    )
    .orderBy(asc(tripMember.joinedAt), asc(user.id));
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
// who is going (id, name, photo). The owner chose to show this to a visitor before sign-in;
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
    .select({ id: user.id, name: user.name, image: user.image })
    .from(tripMember)
    .innerJoin(user, eq(user.id, tripMember.userId))
    .where(eq(tripMember.tripId, found.id))
    .orderBy(asc(tripMember.joinedAt), asc(user.id));
  return { ...found, members };
}

export async function isTripMember(tripId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ one: tripMember.userId })
    .from(tripMember)
    .where(and(eq(tripMember.tripId, tripId), eq(tripMember.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// Adds the person to the trip that owns this code and returns the trip id, or null when
// the code opens nothing. Joining twice changes nothing. Only the join action calls this,
// never a page load, so link previews and prefetching can't add anyone.
export async function joinTripByInviteCode(
  code: string,
  userId: string,
): Promise<string | null> {
  if (!isInviteCode(code)) return null;
  const found = await db
    .select({ id: trip.id })
    .from(trip)
    .where(eq(trip.inviteCode, code.toLowerCase()))
    .limit(1);
  const tripId = found[0]?.id;
  if (!tripId) return null;
  await db.insert(tripMember).values({ tripId, userId }).onConflictDoNothing();
  return tripId;
}
