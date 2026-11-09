import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the schedule privacy layer against the real dev database, with made-up people and
// trips that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as trips.dev-db.test.ts and ideas.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every row this test adds has an id starting with ID_PREFIX, and cleanup removes only
//   those rows, including any left by an earlier run that crashed. (The prefix differs from
//   the other dev-db tests, so the files can run at the same time without touching each
//   other.)

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-sched-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const MEMBER = `${ID_PREFIX}member-${RUN}`;
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const OWNER_TWO = `${ID_PREFIX}owner-two-${RUN}`;

const tripInput = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  destination: null,
};

const ideaInput = {
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: null,
  area: null,
  costPerPerson: null,
  notes: null,
};

const morning = { day: "2027-03-12", slot: "morning", time: null };

function devDatabaseAddress(): string {
  let address: string | undefined;
  try {
    address = parseEnv(readFileSync(".env.development.local", "utf8")).DATABASE_URL;
  } catch {
    throw new Error("Stopped: could not load .env.development.local. Nothing was contacted.");
  }
  if (!address || !URL.canParse(address)) {
    throw new Error("Stopped: no usable DATABASE_URL in .env.development.local. Nothing was contacted.");
  }
  return address;
}

describe("schedule privacy layer on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let ideas: typeof import("./ideas");
  let schedule: typeof import("./schedule");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripA: string; // owned by OWNER; MEMBER is a member
  let tripB: string; // a different group, owned by OWNER_TWO

  // A new idea in the trip, approved by the owner unless told otherwise.
  async function approvedIdea(trip: string, by: string, name: string, approve = true) {
    const id = (await ideas.createIdea(trip, by, { ...ideaInput, name }))!;
    if (approve) await ideas.approveIdea(trip, id, by);
    return id;
  }

  const ideaNames = async (trip: string, by: string) =>
    (await ideas.listIdeasForMember(trip, by)).map((row) => row.name);

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    // Schedule items first: they point at test users. Deleting a trip also deletes its
    // member rows, its ideas and their schedule items.
    await db.delete(schema.scheduleItem).where(like(schema.scheduleItem.updatedBy, `${ID_PREFIX}%`));
    await db.delete(schema.ideaVote).where(like(schema.ideaVote.userId, `${ID_PREFIX}%`));
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
    await db.delete(schema.idea).where(like(schema.idea.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`));
  }

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", devDatabaseAddress());
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    dbModule = await import("./db");
    trips = await import("./trips");
    ideas = await import("./ideas");
    schedule = await import("./schedule");
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    await dbModule.db.insert(schema.user).values(
      [OWNER, MEMBER, STRANGER, OWNER_TWO].map((id, index) => ({
        id,
        name: ["Maya Test", "Ben Test", "Cho Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripA = await trips.createTrip(OWNER, tripInput);
    tripB = await trips.createTrip(OWNER_TWO, { ...tripInput, name: "Another group" });
    await dbModule.db.insert(schema.tripMember).values({ tripId: tripA, userId: MEMBER });
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.scheduleItem).where(like(schema.scheduleItem.updatedBy, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.idea).where(like(schema.idea.createdBy, `${ID_PREFIX}%`))).toEqual([]);
  });

  it("lets a member schedule an approved idea, and it leaves the Ideas list", async () => {
    const id = await approvedIdea(tripA, OWNER, "Chợ Bến Thành");
    expect(await ideaNames(tripA, MEMBER)).toContain("Chợ Bến Thành");
    expect((await schedule.listApprovedUnscheduled(tripA, MEMBER)).map((row) => row.id)).toContain(id);

    const itemId = await schedule.addIdeaToSchedule(tripA, MEMBER, { kind: "idea", ideaId: id, ...morning });
    expect(itemId).toEqual(expect.any(String));

    const item = await schedule.getScheduleItemForMember(tripA, itemId!, OWNER);
    expect(item).toMatchObject({
      name: "Chợ Bến Thành",
      ideaType: "sightseeing",
      fromIdea: true,
      notes: null,
      day: "2027-03-12",
      slot: "morning",
      time: null,
      updatedBy: { id: MEMBER, firstName: "Ben" },
    });
    expect(await ideaNames(tripA, MEMBER)).not.toContain("Chợ Bến Thành");
    expect((await schedule.listApprovedUnscheduled(tripA, MEMBER)).map((row) => row.id)).not.toContain(id);
  });

  it("lets a member add a new item with an exact time, accents and line breaks kept", async () => {
    const itemId = await schedule.addNewItem(tripA, OWNER, {
      kind: "new",
      name: "Đón sân bay 🛬",
      notes: "Meet at arrivals.\nBook a van.",
      day: "2027-03-13",
      slot: "time",
      time: "19:30",
    });
    expect(itemId).toEqual(expect.any(String));
    expect(await schedule.getScheduleItemForMember(tripA, itemId!, MEMBER)).toMatchObject({
      name: "Đón sân bay 🛬",
      ideaType: null,
      fromIdea: false,
      notes: "Meet at arrivals.\nBook a van.",
      day: "2027-03-13",
      slot: "time",
      time: "19:30",
      updatedBy: { id: OWNER, firstName: "Maya" },
    });
  });

  it("lists items by day, then Full day, part of day and time in order, with no email", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Order trip" });
    const add = async (name: string, day: string, slot: string, time: string | null) => {
      const id = await schedule.addNewItem(trip, OWNER, { kind: "new", name, notes: null, day, slot, time });
      await new Promise((resolve) => setTimeout(resolve, 15));
      return id;
    };
    await add("evening", "2027-03-12", "evening", null);
    await add("19:30", "2027-03-12", "time", "19:30");
    await add("next day", "2027-03-13", "full", null);
    await add("12:00", "2027-03-12", "time", "12:00");
    await add("afternoon", "2027-03-12", "afternoon", null);
    await add("09:30", "2027-03-12", "time", "09:30");
    await add("morning", "2027-03-12", "morning", null);
    await add("full", "2027-03-12", "full", null);
    await add("tie first", "2027-03-14", "morning", null);
    await add("tie second", "2027-03-14", "morning", null);

    const listed = await schedule.listScheduleForMember(trip, OWNER);
    expect(listed.map((row) => row.name)).toEqual([
      "full",
      "morning",
      "09:30",
      "afternoon",
      "12:00",
      "evening",
      "19:30",
      "next day",
      "tie first",
      "tie second",
    ]);
    expect(JSON.stringify(listed)).not.toContain("@example.test");
  }, 30_000);

  it("gives a stranger nothing: no list, no item, and nothing can be added or changed", async () => {
    const idea = await approvedIdea(tripA, OWNER, "Stranger test idea");
    const [anItem] = await schedule.listScheduleForMember(tripA, OWNER);
    const input = { kind: "new", name: "Sneaky", notes: null, ...morning } as const;

    await expect(schedule.listScheduleForMember(tripA, STRANGER)).resolves.toEqual([]);
    await expect(schedule.getScheduleItemForMember(tripA, anItem.id, STRANGER)).resolves.toBeNull();
    await expect(schedule.listApprovedUnscheduled(tripA, STRANGER)).resolves.toEqual([]);
    await expect(schedule.addNewItem(tripA, STRANGER, input)).resolves.toBeNull();
    await expect(
      schedule.addIdeaToSchedule(tripA, STRANGER, { kind: "idea", ideaId: idea, ...morning }),
    ).resolves.toBeNull();
    await expect(schedule.moveScheduleItem(tripA, anItem.id, STRANGER, input)).resolves.toBe(false);
    await expect(schedule.removeScheduleItem(tripA, anItem.id, STRANGER)).resolves.toBe(false);

    const after = await schedule.listScheduleForMember(tripA, OWNER);
    expect(after.some((row) => row.name === "Sneaky" || row.updatedBy.id === STRANGER)).toBe(false);
    await expect(schedule.getScheduleItemForMember(tripA, anItem.id, OWNER)).resolves.not.toBeNull();
  });

  it("refuses an idea that is not approved, already scheduled, or from another trip", async () => {
    const notApproved = await approvedIdea(tripA, OWNER, "Not approved", false);
    await expect(
      schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId: notApproved, ...morning }),
    ).resolves.toBeNull();

    const once = await approvedIdea(tripA, OWNER, "Only once");
    const first = await schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId: once, ...morning });
    expect(first).toEqual(expect.any(String));
    await expect(
      schedule.addIdeaToSchedule(tripA, MEMBER, { kind: "idea", ideaId: once, day: "2027-03-13", slot: "full", time: null }),
    ).resolves.toBeNull();

    // Two taps at once: exactly one wins and nothing throws.
    const twice = await approvedIdea(tripA, OWNER, "Double tap");
    const results = await Promise.all([
      schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId: twice, ...morning }),
      schedule.addIdeaToSchedule(tripA, MEMBER, { kind: "idea", ideaId: twice, ...morning }),
    ]);
    expect(results.filter((id) => id !== null)).toHaveLength(1);
    const copies = await dbModule.db
      .select()
      .from(schema.scheduleItem)
      .where(orm.eq(schema.scheduleItem.ideaId, twice));
    expect(copies).toHaveLength(1);

    // An idea of trip B, through trip A's address or by a member of A.
    const inB = await approvedIdea(tripB, OWNER_TWO, "Group B idea");
    await expect(
      schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId: inB, ...morning }),
    ).resolves.toBeNull();
    await expect(
      schedule.addIdeaToSchedule(tripB, OWNER, { kind: "idea", ideaId: inB, ...morning }),
    ).resolves.toBeNull();
    await expect(schedule.listScheduleForMember(tripB, OWNER_TWO)).resolves.toEqual([]);
  });

  it("keeps two groups apart: items and ids never cross", async () => {
    const itemB = (await schedule.addNewItem(tripB, OWNER_TWO, { kind: "new", name: "Group B item", notes: null, ...morning }))!;
    const [inA] = await schedule.listScheduleForMember(tripA, OWNER);
    const change = { kind: "new", name: "Hijacked", notes: null, ...morning } as const;

    await expect(schedule.getScheduleItemForMember(tripA, itemB, OWNER)).resolves.toBeNull();
    await expect(schedule.getScheduleItemForMember(tripB, inA.id, OWNER_TWO)).resolves.toBeNull();
    await expect(schedule.moveScheduleItem(tripA, itemB, OWNER, change)).resolves.toBe(false);
    await expect(schedule.moveScheduleItem(tripB, inA.id, OWNER_TWO, change)).resolves.toBe(false);
    await expect(schedule.removeScheduleItem(tripA, itemB, OWNER)).resolves.toBe(false);
    await expect(schedule.removeScheduleItem(tripB, inA.id, OWNER_TWO)).resolves.toBe(false);
    expect((await schedule.listScheduleForMember(tripB, OWNER_TWO)).map((row) => row.name)).toEqual(["Group B item"]);
  });

  it("moves an item, records who moved it, and keeps an idea's name", async () => {
    const ideaId = await approvedIdea(tripA, OWNER, "Moving idea");
    const ideaItem = (await schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId, ...morning }))!;
    await expect(
      schedule.moveScheduleItem(tripA, ideaItem, MEMBER, {
        kind: "idea",
        ideaId,
        day: "2027-03-14",
        slot: "time",
        time: "08:15",
      }),
    ).resolves.toBe(true);
    expect(await schedule.getScheduleItemForMember(tripA, ideaItem, OWNER)).toMatchObject({
      name: "Moving idea",
      day: "2027-03-14",
      slot: "time",
      time: "08:15",
      updatedBy: { id: MEMBER, firstName: "Ben" },
    });
    // Back to a part of day: the time goes away.
    await schedule.moveScheduleItem(tripA, ideaItem, OWNER, { kind: "idea", ideaId, day: "2027-03-14", slot: "evening", time: null });
    expect(await schedule.getScheduleItemForMember(tripA, ideaItem, OWNER)).toMatchObject({
      slot: "evening",
      time: null,
      updatedBy: { id: OWNER, firstName: "Maya" },
    });

    const newItem = (await schedule.addNewItem(tripA, OWNER, { kind: "new", name: "Old name", notes: "old", ...morning }))!;
    await expect(
      schedule.moveScheduleItem(tripA, newItem, MEMBER, { kind: "new", name: "Tên mới", notes: null, day: "2027-03-15", slot: "full", time: null }),
    ).resolves.toBe(true);
    expect(await schedule.getScheduleItemForMember(tripA, newItem, OWNER)).toMatchObject({
      name: "Tên mới",
      notes: null,
      day: "2027-03-15",
      slot: "full",
      updatedBy: { id: MEMBER, firstName: "Ben" },
    });
  });

  it("does not let one kind of input change the other kind of item", async () => {
    const ideaId = await approvedIdea(tripA, OWNER, "Kind guard idea");
    const ideaItem = (await schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId, ...morning }))!;
    const newItem = (await schedule.addNewItem(tripA, OWNER, { kind: "new", name: "Kind guard item", notes: null, ...morning }))!;

    await expect(
      schedule.moveScheduleItem(tripA, ideaItem, OWNER, { kind: "new", name: "Renamed", notes: null, day: "2027-03-15", slot: "full", time: null }),
    ).resolves.toBe(false);
    await expect(
      schedule.moveScheduleItem(tripA, newItem, OWNER, { kind: "idea", ideaId, day: "2027-03-15", slot: "full", time: null }),
    ).resolves.toBe(false);
    expect(await schedule.getScheduleItemForMember(tripA, ideaItem, OWNER)).toMatchObject({ name: "Kind guard idea", day: "2027-03-12" });
    expect(await schedule.getScheduleItemForMember(tripA, newItem, OWNER)).toMatchObject({ name: "Kind guard item", day: "2027-03-12" });
  });

  it("sends an idea back to Approved when its item is removed, and repeating is harmless", async () => {
    const ideaId = await approvedIdea(tripA, OWNER, "Comes back");
    const item = (await schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId, ...morning }))!;
    expect(await ideaNames(tripA, OWNER)).not.toContain("Comes back");

    await expect(schedule.removeScheduleItem(tripA, item, MEMBER)).resolves.toBe(true);
    await expect(schedule.removeScheduleItem(tripA, item, MEMBER)).resolves.toBe(false);

    const back = (await ideas.listIdeasForMember(tripA, OWNER)).find((row) => row.id === ideaId);
    expect(back?.approvedAt).toBeInstanceOf(Date); // still approved
    expect((await schedule.listApprovedUnscheduled(tripA, OWNER)).map((row) => row.id)).toContain(ideaId);
  });

  it("deletes a new item for good", async () => {
    const item = (await schedule.addNewItem(tripA, OWNER, { kind: "new", name: "Delete me", notes: null, ...morning }))!;
    await expect(schedule.removeScheduleItem(tripA, item, MEMBER)).resolves.toBe(true);
    await expect(schedule.getScheduleItemForMember(tripA, item, OWNER)).resolves.toBeNull();
  });

  it("refuses to move a scheduled idea back to Ideas until it leaves the schedule", async () => {
    const ideaId = await approvedIdea(tripA, OWNER, "Stay approved");
    const item = (await schedule.addIdeaToSchedule(tripA, OWNER, { kind: "idea", ideaId, ...morning }))!;
    await expect(ideas.unapproveIdea(tripA, ideaId, OWNER)).resolves.toBe(false);
    await schedule.removeScheduleItem(tripA, item, OWNER);
    await expect(ideas.unapproveIdea(tripA, ideaId, OWNER)).resolves.toBe(true);
  });

  it("knows when a trip's ideas are on the schedule, for members only", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Every idea scheduled" });
    await expect(ideas.hasScheduledIdeas(trip, OWNER)).resolves.toBe(false);
    // A new item does not count, and neither does an approved idea that is not scheduled.
    await schedule.addNewItem(trip, OWNER, { kind: "new", name: "Airport transfer", notes: null, ...morning });
    const ideaId = await approvedIdea(trip, OWNER, "Bánh mì Huỳnh Hoa");
    await expect(ideas.hasScheduledIdeas(trip, OWNER)).resolves.toBe(false);
    await schedule.addIdeaToSchedule(trip, OWNER, { kind: "idea", ideaId, ...morning });
    await expect(ideas.hasScheduledIdeas(trip, OWNER)).resolves.toBe(true);
    await expect(ideas.hasScheduledIdeas(trip, STRANGER)).resolves.toBe(false);
    await expect(ideaNames(trip, OWNER)).resolves.toEqual([]);
  });

  it("removes an item when its idea is deleted, and all items when the trip is deleted", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Doomed trip" });
    const ideaId = await approvedIdea(trip, OWNER, "Doomed idea");
    const ideaItem = (await schedule.addIdeaToSchedule(trip, OWNER, { kind: "idea", ideaId, ...morning }))!;
    const newItem = (await schedule.addNewItem(trip, OWNER, { kind: "new", name: "Doomed item", notes: null, ...morning }))!;

    await expect(ideas.deleteIdea(trip, ideaId, OWNER)).resolves.toBe(true);
    await expect(schedule.getScheduleItemForMember(trip, ideaItem, OWNER)).resolves.toBeNull();
    await expect(schedule.getScheduleItemForMember(trip, newItem, OWNER)).resolves.not.toBeNull();

    await expect(trips.deleteTripForOwner(trip, OWNER)).resolves.toBe(true);
    const rows = await dbModule.db.select().from(schema.scheduleItem).where(orm.eq(schema.scheduleItem.tripId, trip));
    expect(rows).toEqual([]);
    // Another group's items are untouched.
    await expect(schedule.listScheduleForMember(tripB, OWNER_TWO)).resolves.not.toEqual([]);
  });

  it("is protected by the database itself: bad kinds and bad times are refused", async () => {
    const { db } = dbModule;
    const base = { tripId: tripA, day: "2027-03-12", updatedBy: OWNER };
    // Neither an idea nor a name, and an exact time with no time.
    await expect(db.insert(schema.scheduleItem).values({ ...base, slot: "morning" })).rejects.toThrow();
    await expect(db.insert(schema.scheduleItem).values({ ...base, name: "x", slot: "time" })).rejects.toThrow();
    // A time on a part of day.
    await expect(
      db.insert(schema.scheduleItem).values({ ...base, name: "x", slot: "morning", time: "09:00" }),
    ).rejects.toThrow();
  });
});
