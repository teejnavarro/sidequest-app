import "server-only";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/db/auth-schema";
import { idea, scheduleItem, trip } from "@/db/trip-schema";
import { isMemberOf, notScheduled } from "@/lib/ideas";
import type { ScheduleInput } from "@/lib/schedule-input";
import { compareItems } from "@/lib/schedule-options";

// The privacy layer for the schedule, next to trips.ts and ideas.ts. Same rules: every
// function checks that the person is a member of the trip inside the same database query, so
// a stranger can never get a row or change one. Nothing here ever returns an email address.
// Pages and actions must not query the schedule_item table any other way.

export type ScheduleListItem = {
  id: string;
  // The idea's name for an idea item, the item's own name for a new one.
  name: string;
  // The idea's type when the item came from an idea, else null.
  ideaType: string | null;
  fromIdea: boolean;
  notes: string | null;
  day: string; // "YYYY-MM-DD"
  slot: string;
  time: string | null; // "HH:MM" when slot is "time"
  createdAt: Date;
  updatedBy: { id: string; firstName: string };
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const itemColumns = {
  id: scheduleItem.id,
  ideaId: scheduleItem.ideaId,
  ideaName: idea.name,
  ideaType: idea.type,
  ownName: scheduleItem.name,
  notes: scheduleItem.notes,
  day: scheduleItem.day,
  slot: scheduleItem.slot,
  time: scheduleItem.time,
  createdAt: scheduleItem.createdAt,
  updatedById: user.id,
  updatedByName: user.name,
};

type ItemRow = {
  id: string;
  ideaId: string | null;
  ideaName: string | null;
  ideaType: string | null;
  ownName: string | null;
  notes: string | null;
  day: string;
  slot: string;
  time: string | null;
  createdAt: Date;
  updatedById: string;
  updatedByName: string;
};

function toItem(row: ItemRow): ScheduleListItem {
  return {
    id: row.id,
    name: row.ideaName ?? row.ownName ?? "",
    ideaType: row.ideaType,
    fromIdea: row.ideaId !== null,
    notes: row.notes,
    day: row.day,
    slot: row.slot,
    time: row.time,
    createdAt: row.createdAt,
    updatedBy: { id: row.updatedById, firstName: firstName(row.updatedByName) },
  };
}

// Everything on the trip's schedule, by day and then in the order shown: Full day first,
// then by time or part of day. A person who is not in the trip gets an empty list.
export async function listScheduleForMember(
  tripId: string,
  userId: string,
): Promise<ScheduleListItem[]> {
  const rows = await db
    .select(itemColumns)
    .from(scheduleItem)
    .innerJoin(user, eq(user.id, scheduleItem.updatedBy))
    .leftJoin(idea, eq(idea.id, scheduleItem.ideaId))
    .where(and(eq(scheduleItem.tripId, tripId), isMemberOf(tripId, userId)));
  return rows
    .map(toItem)
    .sort((a, b) => a.day.localeCompare(b.day) || compareItems(a, b));
}

// One schedule item, or null when it does not exist, belongs to another trip, or the person
// is not in this trip. The cases look the same on purpose.
export async function getScheduleItemForMember(
  tripId: string,
  itemId: string,
  userId: string,
): Promise<ScheduleListItem | null> {
  const rows = await db
    .select(itemColumns)
    .from(scheduleItem)
    .innerJoin(user, eq(user.id, scheduleItem.updatedBy))
    .leftJoin(idea, eq(idea.id, scheduleItem.ideaId))
    .where(
      and(eq(scheduleItem.id, itemId), eq(scheduleItem.tripId, tripId), isMemberOf(tripId, userId)),
    )
    .limit(1);
  return rows[0] ? toItem(rows[0]) : null;
}

export type ApprovedIdea = { id: string; name: string; type: string };

// Approved ideas that are not on the schedule yet, for the Add page. Empty for a stranger.
export async function listApprovedUnscheduled(
  tripId: string,
  userId: string,
): Promise<ApprovedIdea[]> {
  return db
    .select({ id: idea.id, name: idea.name, type: idea.type })
    .from(idea)
    .where(
      and(
        eq(idea.tripId, tripId),
        isMemberOf(tripId, userId),
        isNotNull(idea.approvedAt),
        notScheduled,
      ),
    )
    .orderBy(asc(idea.approvedAt), asc(idea.id));
}

type IdeaScheduleInput = Extract<ScheduleInput, { kind: "idea" }>;
type NewScheduleInput = Extract<ScheduleInput, { kind: "new" }>;

// Puts an approved idea on a day. The insert reads the idea and checks, in one statement,
// that the person is in the trip and the idea is in this trip, approved and not yet
// scheduled. The unique index on the idea guards two taps at once. Returns the new id, or
// null when nothing was added.
export async function addIdeaToSchedule(
  tripId: string,
  userId: string,
  input: IdeaScheduleInput,
): Promise<string | null> {
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(scheduleItem)
    .select(
      db
        .select({
          id: sql<string>`${id}::text`.as("id"),
          tripId: sql<string>`${idea.tripId}`.as("trip_id"),
          ideaId: sql<string | null>`${idea.id}`.as("idea_id"),
          name: sql<string | null>`null::text`.as("name"),
          notes: sql<string | null>`null::text`.as("notes"),
          day: sql<string>`${input.day}::date`.as("day"),
          slot: sql<string>`${input.slot}::text`.as("slot"),
          time: sql<string | null>`${input.time}::text`.as("time"),
          updatedBy: sql<string>`${userId}::text`.as("updated_by"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(idea)
        .where(
          and(
            eq(idea.id, input.ideaId),
            eq(idea.tripId, tripId),
            isMemberOf(tripId, userId),
            isNotNull(idea.approvedAt),
            notScheduled,
          ),
        ),
    )
    .onConflictDoNothing({ target: scheduleItem.ideaId })
    .returning({ id: scheduleItem.id });
  return inserted[0]?.id ?? null;
}

// Adds a new item (one that needs no vote, like "Airport transfer"), only if the person is
// in the trip. Returns the new id, or null when nothing was added.
export async function addNewItem(
  tripId: string,
  userId: string,
  input: NewScheduleInput,
): Promise<string | null> {
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(scheduleItem)
    .select(
      db
        .select({
          id: sql<string>`${id}::text`.as("id"),
          tripId: sql<string>`${trip.id}`.as("trip_id"),
          ideaId: sql<string | null>`null::text`.as("idea_id"),
          name: sql<string | null>`${input.name}::text`.as("name"),
          notes: sql<string | null>`${input.notes}::text`.as("notes"),
          day: sql<string>`${input.day}::date`.as("day"),
          slot: sql<string>`${input.slot}::text`.as("slot"),
          time: sql<string | null>`${input.time}::text`.as("time"),
          updatedBy: sql<string>`${userId}::text`.as("updated_by"),
          createdAt: sql<Date>`now()`.as("created_at"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(trip)
        .where(and(eq(trip.id, tripId), isMemberOf(tripId, userId))),
    )
    .returning({ id: scheduleItem.id });
  return inserted[0]?.id ?? null;
}

// Moves an item to another day or time and records who did it. A new item can also change
// its name and notes; an idea item keeps the idea's name. The kind of the input must match
// the item: a new item's input never changes an idea item, and the other way round. Returns
// true only when a row changed.
export async function moveScheduleItem(
  tripId: string,
  itemId: string,
  userId: string,
  input: ScheduleInput,
): Promise<boolean> {
  const when = { day: input.day, slot: input.slot, time: input.time, updatedBy: userId };
  const updated = await db
    .update(scheduleItem)
    .set(input.kind === "new" ? { ...when, name: input.name, notes: input.notes } : when)
    .where(
      and(
        eq(scheduleItem.id, itemId),
        eq(scheduleItem.tripId, tripId),
        isMemberOf(tripId, userId),
        input.kind === "new" ? isNull(scheduleItem.ideaId) : isNotNull(scheduleItem.ideaId),
      ),
    )
    .returning({ id: scheduleItem.id });
  return updated.length > 0;
}

// Takes an item off the schedule, for any member. For an idea item this sends the idea back
// to the Approved list; for a new item it deletes it for good. Returns true only when a row
// went, so repeating it is harmless.
export async function removeScheduleItem(
  tripId: string,
  itemId: string,
  userId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(scheduleItem)
    .where(
      and(
        eq(scheduleItem.id, itemId),
        eq(scheduleItem.tripId, tripId),
        isMemberOf(tripId, userId),
      ),
    )
    .returning({ id: scheduleItem.id });
  return deleted.length > 0;
}
