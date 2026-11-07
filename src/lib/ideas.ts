import "server-only";
import { and, desc, eq, exists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { idea, trip, tripMember } from "@/db/trip-schema";
import type { IdeaInput } from "@/lib/idea-input";

// The privacy layer for ideas, next to trips.ts. Same rules: every function checks that the
// person is a member of the trip inside the same database query, so a stranger can never get
// a row or change one. Editing and deleting are narrower still: only the person who added the
// idea, or the trip's owner. Nothing here ever returns an email address. Pages and actions
// must not query the idea table any other way.

export type IdeaItem = {
  id: string;
  name: string;
  type: string;
  duration: string;
  link: string | null;
  area: string | null;
  costPerPerson: number | null;
  costCurrency: string | null;
  notes: string | null;
  createdAt: Date;
  addedBy: { id: string; name: string; image: string | null };
};

export type IdeaDetails = IdeaItem & { canChange: boolean };

const ideaColumns = {
  id: idea.id,
  name: idea.name,
  type: idea.type,
  duration: idea.duration,
  link: idea.link,
  area: idea.area,
  costPerPerson: idea.costPerPerson,
  costCurrency: idea.costCurrency,
  notes: idea.notes,
  createdAt: idea.createdAt,
  addedById: user.id,
  addedByName: user.name,
  addedByImage: user.image,
};

type IdeaRow = {
  id: string;
  name: string;
  type: string;
  duration: string;
  link: string | null;
  area: string | null;
  costPerPerson: number | null;
  costCurrency: string | null;
  notes: string | null;
  createdAt: Date;
  addedById: string;
  addedByName: string;
  addedByImage: string | null;
};

function toItem(row: IdeaRow): IdeaItem {
  const { addedById, addedByName, addedByImage, ...rest } = row;
  return { ...rest, addedBy: { id: addedById, name: addedByName, image: addedByImage } };
}

// True when the person is in the trip. Used inside the queries below, never on its own.
function isMemberOf(tripId: string, userId: string) {
  const viewer = alias(tripMember, "viewer");
  return exists(
    db
      .select({ one: viewer.userId })
      .from(viewer)
      .where(and(eq(viewer.tripId, tripId), eq(viewer.userId, userId))),
  );
}

// May this person change the idea: they added it, or they own the trip.
function mayChange(userId: string) {
  return or(
    eq(idea.createdBy, userId),
    exists(
      db
        .select({ one: trip.id })
        .from(trip)
        .where(and(eq(trip.id, idea.tripId), eq(trip.ownerId, userId))),
    ),
  );
}

// The trip's ideas, newest first, each with who added it (name and photo). A person who is
// not in the trip gets an empty list.
export async function listIdeasForMember(tripId: string, userId: string): Promise<IdeaItem[]> {
  const rows = await db
    .select(ideaColumns)
    .from(idea)
    .innerJoin(user, eq(user.id, idea.createdBy))
    .where(and(eq(idea.tripId, tripId), isMemberOf(tripId, userId)))
    .orderBy(desc(idea.createdAt), desc(idea.id));
  return rows.map(toItem);
}

// One idea plus whether this person may change it, or null when it does not exist, belongs
// to another trip, or the person is not in this trip. The cases look the same on purpose.
export async function getIdeaForMember(
  tripId: string,
  ideaId: string,
  userId: string,
): Promise<IdeaDetails | null> {
  const rows = await db
    .select({ ...ideaColumns, createdBy: idea.createdBy, tripOwnerId: trip.ownerId })
    .from(idea)
    .innerJoin(user, eq(user.id, idea.createdBy))
    .innerJoin(trip, eq(trip.id, idea.tripId))
    .where(and(eq(idea.id, ideaId), eq(idea.tripId, tripId), isMemberOf(tripId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { createdBy, tripOwnerId, ...rest } = row;
  return { ...toItem(rest), canChange: createdBy === userId || tripOwnerId === userId };
}

// Adds an idea, only if the person is in the trip: the insert reads the trip and checks
// membership in one statement. The cost is saved with the trip's currency. Returns the new
// id, or null when nothing was added.
export async function createIdea(
  tripId: string,
  userId: string,
  input: IdeaInput,
): Promise<string | null> {
  const id = crypto.randomUUID();
  const cost = input.costPerPerson;
  const inserted = await db
    .insert(idea)
    .select(
      db
        .select({
          id: sql<string>`${id}::text`.as("id"),
          tripId: sql<string>`${trip.id}`.as("trip_id"),
          name: sql<string>`${input.name}::text`.as("name"),
          type: sql<string>`${input.type}::text`.as("type"),
          duration: sql<string>`${input.duration}::text`.as("duration"),
          link: sql<string | null>`${input.link}::text`.as("link"),
          area: sql<string | null>`${input.area}::text`.as("area"),
          costPerPerson: sql<number | null>`${cost}::integer`.as("cost_per_person"),
          costCurrency: sql<string | null>`case when ${cost}::integer is null then null else ${trip.currency} end`.as(
            "cost_currency",
          ),
          notes: sql<string | null>`${input.notes}::text`.as("notes"),
          createdBy: sql<string>`${userId}::text`.as("created_by"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(trip)
        .where(and(eq(trip.id, tripId), isMemberOf(tripId, userId))),
    )
    .returning({ id: idea.id });
  return inserted[0]?.id ?? null;
}

// Changes an idea, only for the person who added it or the trip's owner, who must also be in
// the trip. All of that is in the update's own condition. Returns true only when a row
// changed. Never changes who added it or which trip it is in.
export async function updateIdea(
  tripId: string,
  ideaId: string,
  userId: string,
  input: IdeaInput,
): Promise<boolean> {
  const cost = input.costPerPerson;
  const updated = await db
    .update(idea)
    .set({
      name: input.name,
      type: input.type,
      duration: input.duration,
      link: input.link,
      area: input.area,
      costPerPerson: cost,
      // The trip's currency as it is now, when there is a cost to go with it.
      costCurrency:
        cost === null
          ? null
          : sql`(select ${trip.currency} from ${trip} where ${trip.id} = ${tripId})`,
      notes: input.notes,
    })
    .where(
      and(
        eq(idea.id, ideaId),
        eq(idea.tripId, tripId),
        isMemberOf(tripId, userId),
        mayChange(userId),
      ),
    )
    .returning({ id: idea.id });
  return updated.length > 0;
}

// Deletes an idea for good, under the same condition as updateIdea. Returns true only when
// a row went, so repeating it is harmless.
export async function deleteIdea(
  tripId: string,
  ideaId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(idea)
    .where(
      and(
        eq(idea.id, ideaId),
        eq(idea.tripId, tripId),
        isMemberOf(tripId, userId),
        mayChange(userId),
      ),
    )
    .returning({ id: idea.id });
  return deleted.length > 0;
}
