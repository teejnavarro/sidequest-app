import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the "who is still in the trip" rules (left_at) against the real dev database, with
// made-up people and trips that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as the other dev-db tests):
// - The address comes from .env.development.local and nowhere else. No fallback.
// - Nothing prints the address.
// - Every user and trip this test adds has an id starting with ID_PREFIX, and cleanup removes
//   only those rows, including any left by an earlier run that crashed.

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-members-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const BEA = `${ID_PREFIX}bea-${RUN}`; // a member who stays
const LEAVER = `${ID_PREFIX}leaver-${RUN}`; // a member who leaves or is removed
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const OWNER_TWO = `${ID_PREFIX}owner-two-${RUN}`;

const tripInput = {
  name: "Cebu long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null,
};

const ideaInput = {
  name: "Island hop",
  type: "activity",
  duration: "full",
  link: null,
  area: null,
  costPerPerson: null,
  notes: null,
};

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

describe("members who left, on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let ideas: typeof import("./ideas");
  let schedule: typeof import("./schedule");
  let costs: typeof import("./costs");
  let money: typeof import("./money");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripId: string;
  let code: string;
  let ownerSpot: string;
  let beaSpot: string;
  let leaverSpot: string;

  const costId = (label: string) => `${ID_PREFIX}${label}-${RUN}`;

  async function setLeft(spotId: string, left: boolean) {
    await dbModule.db
      .update(schema.tripMember)
      .set({ leftAt: left ? new Date() : null })
      .where(orm.eq(schema.tripMember.id, spotId));
  }

  async function spotIdOf(forTrip: string, userId: string) {
    const rows = await dbModule.db
      .select()
      .from(schema.tripMember)
      .where(orm.and(orm.eq(schema.tripMember.tripId, forTrip), orm.eq(schema.tripMember.userId, userId)));
    return rows[0]!.id;
  }

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    await db.delete(schema.cost).where(like(schema.cost.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
    await db.delete(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`));
  }

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", devDatabaseAddress());
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    dbModule = await import("./db");
    trips = await import("./trips");
    ideas = await import("./ideas");
    schedule = await import("./schedule");
    costs = await import("./costs");
    money = await import("./money");
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    await cleanUp();
    const people = [OWNER, BEA, LEAVER, STRANGER, OWNER_TWO];
    await dbModule.db.insert(schema.user).values(
      people.map((id, index) => ({
        id,
        name: ["Maya Test", "Bea Test", "Lou Test", "Sam Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripId = await trips.createTrip(OWNER, tripInput);
    code = (await trips.getInviteCodeForMember(tripId, OWNER))!;
    await trips.joinTripByInviteCode(code, BEA);
    await trips.joinTripByInviteCode(code, LEAVER);
    ownerSpot = await spotIdOf(tripId, OWNER);
    beaSpot = await spotIdOf(tripId, BEA);
    leaverSpot = await spotIdOf(tripId, LEAVER);
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.cost).where(like(schema.cost.createdBy, `${ID_PREFIX}%`))).toEqual([]);
  });

  describe("a person who left gets nothing", () => {
    let ideaId: string;
    let scheduleId: string;
    let costRowId: string;

    beforeAll(async () => {
      // Made while the person was still in the trip, so there is something to hide.
      ideaId = (await ideas.createIdea(tripId, LEAVER, ideaInput))!;
      scheduleId = (await schedule.addNewItem(tripId, LEAVER, {
        kind: "new",
        name: "Airport transfer",
        notes: null,
        day: "2027-03-12",
        slot: "full",
        time: null,
      }))!;
      costRowId = costId("leaver-paid");
      await costs.createCost(tripId, LEAVER, costRowId, {
        description: "Boat",
        amount: 90000,
        paidBy: leaverSpot,
        category: null,
        spentOn: "2027-03-12",
        shares: money.splitEqually(90000, [ownerSpot, beaSpot, leaverSpot], leaverSpot),
      });
      await setLeft(leaverSpot, true);
    });

    it("sees no trip, no list entry, no people and no invite code", async () => {
      await expect(trips.getTripForMember(tripId, LEAVER)).resolves.toBeNull();
      await expect(trips.listMyTrips(LEAVER)).resolves.toEqual([]);
      await expect(trips.listTripMembers(tripId, LEAVER)).resolves.toEqual([]);
      await expect(trips.getInviteCodeForMember(tripId, LEAVER)).resolves.toBeNull();
      await expect(trips.isTripMember(tripId, LEAVER)).resolves.toBe(false);
    });

    it("can't change the trip or add a guest", async () => {
      await expect(trips.updateTripForMember(tripId, LEAVER, tripInput)).resolves.toBe(false);
      await expect(trips.addGuest(tripId, LEAVER, "Ghost Guest")).resolves.toBe("not-found");
    });

    it("sees no ideas, schedule or costs, and can't add any", async () => {
      await expect(ideas.listIdeasForMember(tripId, LEAVER)).resolves.toEqual([]);
      await expect(ideas.getIdeaForMember(tripId, ideaId, LEAVER)).resolves.toBeNull();
      await expect(schedule.listScheduleForMember(tripId, LEAVER)).resolves.toEqual([]);
      await expect(schedule.getScheduleItemForMember(tripId, scheduleId, LEAVER)).resolves.toBeNull();
      await expect(costs.listCostsForMember(tripId, LEAVER)).resolves.toEqual({ costs: [], total: 0 });
      await expect(costs.getCostForMember(tripId, costRowId, LEAVER)).resolves.toBeNull();
      await expect(ideas.createIdea(tripId, LEAVER, ideaInput)).resolves.toBeNull();
      await expect(
        schedule.addNewItem(tripId, LEAVER, {
          kind: "new",
          name: "Nope",
          notes: null,
          day: "2027-03-12",
          slot: "full",
          time: null,
        }),
      ).resolves.toBeNull();
      await expect(
        costs.createCost(tripId, LEAVER, costId("sneaky"), {
          description: "Nope",
          amount: 100,
          paidBy: ownerSpot,
          category: null,
          spentOn: "2027-03-12",
          shares: [{ spotId: ownerSpot, amount: 100 }],
        }),
      ).resolves.toBe("not-found");
    });

    it("is gone from what the others see, and from the invite preview", async () => {
      const members = await trips.listTripMembers(tripId, OWNER);
      expect(members.map((row) => row.id)).toEqual([OWNER, BEA]);
      expect(members.every((row) => row.hasLeft === false)).toBe(true);
      const mine = await trips.listMyTrips(OWNER);
      expect(mine[0]!.members.map((row) => row.id)).toEqual([OWNER, BEA]);
      const preview = await trips.getTripByInviteCode(code);
      expect(preview!.members.map((row) => row.id)).toEqual([OWNER, BEA]);
    });

    it("keeps the person's cost, marked as paid by someone who left", async () => {
      const list = await costs.listCostsForMember(tripId, OWNER);
      expect(list.costs).toHaveLength(1);
      expect(list.costs[0]!.payer).toMatchObject({ spotId: leaverSpot, name: "Lou Test" });
    });

    it("sees everything again when the mark is cleared", async () => {
      await setLeft(leaverSpot, false);
      await expect(trips.isTripMember(tripId, LEAVER)).resolves.toBe(true);
      await expect(trips.getTripForMember(tripId, LEAVER)).resolves.not.toBeNull();
      await expect(ideas.getIdeaForMember(tripId, ideaId, LEAVER)).resolves.not.toBeNull();
      await setLeft(leaverSpot, true);
    });
  });
});
