import {
  bigint,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

export const trip = pgTable("trip", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  // Calendar days with no time of day. String mode keeps "2027-03-12" exactly as typed.
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  timeZone: text("time_zone").notNull(),
  currency: text("currency").notNull(),
  // Where the trip goes (optional), for example a city. Empty is stored as null.
  destination: text("destination"),
  // The secret in the invite link. The database fills it with 122 random bits, also
  // for trips that already exist. Never sent to anyone who is not a member.
  inviteCode: text("invite_code")
    .notNull()
    .unique()
    .default(sql`gen_random_uuid()::text`),
  // No cascade from user: the account deletion story decides what happens here.
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// A spot in the trip: either a signed-in person (userId) or a guest who has no account
// yet (guestName, addedBy). Claiming a guest fills in userId on the same row, so anything
// tied to the spot (costs later) keeps working.
export const tripMember = pgTable(
  "trip_member",
  {
    // The database fills it, also for rows that already exist.
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    // Null while the spot is a guest.
    userId: text("user_id").references(() => user.id),
    // Only while the spot is a guest.
    guestName: text("guest_name"),
    // Who added the guest. Null for people who joined. No cascade, like the other user links.
    addedBy: text("added_by").references(() => user.id),
    // When the spot was made; the order of the list.
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    index("trip_member_userId_idx").on(table.userId),
    // A person is in a trip once (nulls don't clash).
    uniqueIndex("trip_member_trip_user_unique").on(table.tripId, table.userId),
    // A guest name is used once per trip, ignoring capitals.
    uniqueIndex("trip_member_trip_guest_name_unique")
      .on(table.tripId, sql`lower(${table.guestName})`)
      .where(sql`${table.guestName} is not null`),
    check(
      "trip_member_kind_check",
      sql`(${table.userId} is null) <> (${table.guestName} is null)`,
    ),
  ],
);

// Something the group might do on the trip. Ideas go with their trip when it is deleted.
export const idea = pgTable(
  "idea",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    // Saved exactly as typed, accents and all.
    name: text("name").notNull(),
    type: text("type").notNull(), // one of IDEA_TYPES
    duration: text("duration").notNull(), // "short" | "half" | "full"
    link: text("link"),
    area: text("area"),
    // Whole units of the trip's currency. Null when left blank.
    costPerPerson: integer("cost_per_person"),
    // The trip's currency at the time the cost was saved.
    costCurrency: text("cost_currency"),
    notes: text("notes"),
    // Null means not approved. Any member can approve and move it back.
    approvedAt: timestamp("approved_at"),
    // No cascade, like createdBy: the account deletion story decides.
    approvedBy: text("approved_by").references(() => user.id),
    // No cascade from user: the account deletion story decides what happens here.
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("idea_tripId_idx").on(table.tripId)],
);

// One thumbs up or down per person per idea. Votes go with their idea.
export const ideaVote = pgTable(
  "idea_vote",
  {
    ideaId: text("idea_id")
      .notNull()
      .references(() => idea.id, { onDelete: "cascade" }),
    // No cascade from user: the account deletion story decides what happens here.
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    value: smallint("value").notNull(), // 1 (up) or -1 (down)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ideaId, table.userId] }),
    index("idea_vote_userId_idx").on(table.userId),
    check("idea_vote_value_check", sql`${table.value} in (1, -1)`),
  ],
);

// One thing on the day-by-day schedule: either an approved idea (ideaId set, the name
// comes from the idea) or a new item with its own name. Items go with their trip or idea.
export const scheduleItem = pgTable(
  "schedule_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    // Null for a new item. An idea is on the schedule at most once.
    ideaId: text("idea_id").references(() => idea.id, { onDelete: "cascade" }),
    // Only for new items; an idea item shows the idea's name.
    name: text("name"),
    notes: text("notes"),
    // A trip day, "YYYY-MM-DD".
    day: date("day", { mode: "string" }).notNull(),
    slot: text("slot").notNull(), // "full" | "morning" | "afternoon" | "evening" | "time"
    // Wall-clock "HH:MM" in the trip's own time zone, never converted. Only when slot is "time".
    time: text("time"),
    // No cascade from user: the account deletion story decides what happens here.
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("schedule_item_tripId_idx").on(table.tripId),
    uniqueIndex("schedule_item_ideaId_unique").on(table.ideaId),
    check(
      "schedule_item_kind_check",
      sql`(${table.ideaId} is null) <> (${table.name} is null)`,
    ),
    check(
      "schedule_item_time_check",
      sql`(${table.slot} = 'time') = (${table.time} is not null)`,
    ),
  ],
);

// One shared cost. The amount is whole minor units of `currency` (centavos; whole dong).
// Costs go with their trip. The id is made by the form, so a double tap saves once.
export const cost = pgTable(
  "cost",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    // The trip's currency when the cost was saved.
    currency: text("currency").notNull(),
    // A spot (trip_member.id), not a user, so a claimed guest keeps its costs. No cascade.
    paidBy: text("paid_by")
      .notNull()
      .references(() => tripMember.id),
    // Null or one of COST_CATEGORIES.
    category: text("category"),
    // A calendar day, "YYYY-MM-DD".
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    // No cascade from user: the account deletion story decides what happens here.
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("cost_tripId_idx").on(table.tripId),
    check("cost_amount_positive", sql`${table.amount} > 0`),
  ],
);

// One person's part of a cost. Shares of a cost add up to cost.amount (see splitEqually).
export const costShare = pgTable(
  "cost_share",
  {
    costId: text("cost_id")
      .notNull()
      .references(() => cost.id, { onDelete: "cascade" }),
    // A spot (trip_member.id). No cascade: a spot that is in a cost can't be deleted.
    spotId: text("spot_id")
      .notNull()
      .references(() => tripMember.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.costId, table.spotId] }),
    index("cost_share_spotId_idx").on(table.spotId),
    check("cost_share_amount_nonnegative", sql`${table.amount} >= 0`),
  ],
);
