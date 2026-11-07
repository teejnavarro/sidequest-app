import "server-only";
import { and, desc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { idea, ideaVote, trip, tripMember } from "@/db/trip-schema";
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
  // Counts only: never who voted. myVote is the viewer's own thumb.
  up: number;
  down: number;
  myVote: 1 | -1 | null;
  approvedAt: Date | null;
  approvedBy: { id: string; name: string } | null;
};

export type IdeaDetails = IdeaItem & { canChange: boolean };

const approver = alias(user, "approver");

// The vote counts and the viewer's own vote, read inside the same query as the idea.
function voteColumns(userId: string) {
  return {
    up: sql<number>`(select count(*) filter (where ${ideaVote.value} = 1) from ${ideaVote} where ${ideaVote.ideaId} = ${idea.id})`.mapWith(
      Number,
    ),
    down: sql<number>`(select count(*) filter (where ${ideaVote.value} = -1) from ${ideaVote} where ${ideaVote.ideaId} = ${idea.id})`.mapWith(
      Number,
    ),
    myVote: sql<1 | -1 | null>`(select ${ideaVote.value} from ${ideaVote} where ${ideaVote.ideaId} = ${idea.id} and ${ideaVote.userId} = ${userId})`,
  };
}

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
  approvedAt: idea.approvedAt,
  approverId: approver.id,
  approverName: approver.name,
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
  approvedAt: Date | null;
  approverId: string | null;
  approverName: string | null;
  up: number;
  down: number;
  myVote: 1 | -1 | null;
};

function toItem(row: IdeaRow): IdeaItem {
  const { addedById, addedByName, addedByImage, approverId, approverName, ...rest } = row;
  return {
    ...rest,
    addedBy: { id: addedById, name: addedByName, image: addedByImage },
    approvedBy: approverId && approverName ? { id: approverId, name: approverName } : null,
  };
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

// The trip's ideas, most liked first (up minus down, then most thumbs up, then newest), each
// with who added it (name and photo), its vote counts, the viewer's own vote and who approved
// it. A person who is not in the trip gets an empty list.
export async function listIdeasForMember(tripId: string, userId: string): Promise<IdeaItem[]> {
  const rows = await db
    .select({ ...ideaColumns, ...voteColumns(userId) })
    .from(idea)
    .innerJoin(user, eq(user.id, idea.createdBy))
    .leftJoin(approver, eq(approver.id, idea.approvedBy))
    .where(and(eq(idea.tripId, tripId), isMemberOf(tripId, userId)))
    .orderBy(
      sql`(select coalesce(sum(${ideaVote.value}), 0) from ${ideaVote} where ${ideaVote.ideaId} = ${idea.id}) desc`,
      sql`(select count(*) filter (where ${ideaVote.value} = 1) from ${ideaVote} where ${ideaVote.ideaId} = ${idea.id}) desc`,
      desc(idea.createdAt),
      desc(idea.id),
    );
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
    .select({ ...ideaColumns, ...voteColumns(userId), createdBy: idea.createdBy, tripOwnerId: trip.ownerId })
    .from(idea)
    .innerJoin(user, eq(user.id, idea.createdBy))
    .leftJoin(approver, eq(approver.id, idea.approvedBy))
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
          approvedAt: sql<Date | null>`null::timestamp`.as("approved_at"),
          approvedBy: sql<string | null>`null::text`.as("approved_by"),
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

export type VoteResult = { up: number; down: number; myVote: 1 | -1 | null };

// Gives, switches or takes back this person's vote. Tapping the thumb you already gave takes
// it back; the other thumb switches it. Membership and "the idea is in this trip" are checked
// inside each statement. neon-http has no interactive transactions, so this is a few single
// statements and a final read; if two taps race, the next read is the truth. Returns the
// counts after the change, or null when the person may not vote on this idea.
export async function setVote(
  tripId: string,
  ideaId: string,
  userId: string,
  choice: 1 | -1,
): Promise<VoteResult | null> {
  const ideaInTrip = and(
    eq(idea.id, ideaId),
    eq(idea.tripId, tripId),
    isMemberOf(tripId, userId),
  );
  const removed = await db
    .delete(ideaVote)
    .where(
      and(
        eq(ideaVote.ideaId, ideaId),
        eq(ideaVote.userId, userId),
        eq(ideaVote.value, choice),
        exists(db.select({ one: idea.id }).from(idea).where(ideaInTrip)),
      ),
    )
    .returning({ ideaId: ideaVote.ideaId });
  if (removed.length === 0) {
    await db
      .insert(ideaVote)
      .select(
        db
          .select({
            ideaId: sql<string>`${idea.id}`.as("idea_id"),
            userId: sql<string>`${userId}::text`.as("user_id"),
            value: sql<number>`${choice}::smallint`.as("value"),
            createdAt: sql<Date>`now()`.as("created_at"),
            updatedAt: sql<Date>`now()`.as("updated_at"),
          })
          .from(idea)
          .where(ideaInTrip),
      )
      .onConflictDoUpdate({
        target: [ideaVote.ideaId, ideaVote.userId],
        set: { value: choice, updatedAt: new Date() },
      });
  }
  const rows = await db.select(voteColumns(userId)).from(idea).where(ideaInTrip).limit(1);
  return rows[0] ?? null;
}

// Approves an idea for any member. Returns true only when it changed, so approving twice is
// harmless and the first approver stays.
export async function approveIdea(
  tripId: string,
  ideaId: string,
  userId: string,
): Promise<boolean> {
  const updated = await db
    .update(idea)
    .set({ approvedAt: new Date(), approvedBy: userId })
    .where(
      and(
        eq(idea.id, ideaId),
        eq(idea.tripId, tripId),
        isMemberOf(tripId, userId),
        isNull(idea.approvedAt),
      ),
    )
    .returning({ id: idea.id });
  return updated.length > 0;
}

// Moves an approved idea back to the ideas list, for any member. True only when it changed.
export async function unapproveIdea(
  tripId: string,
  ideaId: string,
  userId: string,
): Promise<boolean> {
  const updated = await db
    .update(idea)
    .set({ approvedAt: null, approvedBy: null })
    .where(
      and(
        eq(idea.id, ideaId),
        eq(idea.tripId, tripId),
        isMemberOf(tripId, userId),
        sql`${idea.approvedAt} is not null`,
      ),
    )
    .returning({ id: idea.id });
  return updated.length > 0;
}
