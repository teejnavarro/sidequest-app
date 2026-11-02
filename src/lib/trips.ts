import "server-only";
import { and, desc, eq, exists } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { trip, tripMember } from "@/db/trip-schema";
import type { TripInput } from "@/lib/trip-input";

// The one door to trip data. Every function here checks that the person is a member
// of the trip inside the same database query, so a stranger can never get a row.
// Pages and actions must not query the trip tables any other way. Nothing returned
// here ever includes an email address.

export type TripSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  currency: string;
};

export type TripDetails = TripSummary & {
  ownerId: string;
  ownerName: string;
  ownerImage: string | null;
};

// Every trip the person belongs to, newest first.
export async function listMyTrips(userId: string): Promise<TripSummary[]> {
  return db
    .select({
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timeZone: trip.timeZone,
      currency: trip.currency,
    })
    .from(trip)
    .innerJoin(tripMember, eq(tripMember.tripId, trip.id))
    .where(eq(tripMember.userId, userId))
    .orderBy(desc(trip.createdAt));
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
