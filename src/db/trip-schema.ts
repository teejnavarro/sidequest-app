import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
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

export const tripMember = pgTable(
  "trip_member",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => trip.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    index("trip_member_userId_idx").on(table.userId),
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
