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

// Each case makes a fresh trip and does many round trips to the real database.
vi.setConfig({ testTimeout: 60_000 });

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

  // A fresh trip for each case below: OWNER, BEA and LEAVER are people, plus one guest.
  async function freshTrip() {
    const id = await trips.createTrip(OWNER, tripInput);
    const inviteCode = (await trips.getInviteCodeForMember(id, OWNER))!;
    await trips.joinTripByInviteCode(inviteCode, BEA);
    await trips.joinTripByInviteCode(inviteCode, LEAVER);
    await trips.addGuest(id, OWNER, "Gus Guest");
    const [owner, bea, leaver] = await Promise.all([OWNER, BEA, LEAVER].map((u) => spotIdOf(id, u)));
    const [guestRow] = await dbModule.db
      .select()
      .from(schema.tripMember)
      .where(orm.and(orm.eq(schema.tripMember.tripId, id), orm.isNull(schema.tripMember.userId)));
    return { id, inviteCode, owner: owner!, bea: bea!, leaver: leaver!, guest: guestRow!.id };
  }

  async function ownerOf(id: string) {
    const [row] = await dbModule.db.select().from(schema.trip).where(orm.eq(schema.trip.id, id));
    return row!.ownerId;
  }

  async function spotRow(spotId: string) {
    const [row] = await dbModule.db.select().from(schema.tripMember).where(orm.eq(schema.tripMember.id, spotId));
    return row!;
  }

  describe("removing a member", () => {
    it("lets only the owner see and remove another person who is in the trip", async () => {
      const t = await freshTrip();
      await expect(trips.getMemberForOwner(t.id, t.leaver, BEA)).resolves.toBeNull();
      await expect(trips.getMemberForOwner(t.id, t.leaver, STRANGER)).resolves.toBeNull();
      await expect(trips.removeMember(t.id, t.leaver, BEA)).resolves.toBe(false);
      await expect(trips.removeMember(t.id, t.leaver, STRANGER)).resolves.toBe(false);
      expect((await spotRow(t.leaver)).leftAt).toBeNull();

      await costs.createCost(t.id, OWNER, costId("part-of"), {
        description: "Taxi",
        amount: 50000,
        paidBy: t.owner,
        category: null,
        spentOn: "2027-03-12",
        shares: money.splitEqually(50000, [t.owner, t.leaver], t.owner),
      });
      await expect(trips.getMemberForOwner(t.id, t.leaver, OWNER)).resolves.toEqual({
        spotId: t.leaver,
        userId: LEAVER,
        name: "Lou Test",
        image: null,
        costCount: 1,
      });
      await expect(trips.removeMember(t.id, t.leaver, OWNER)).resolves.toBe(true);
      expect((await spotRow(t.leaver)).leftAt).not.toBeNull();
      await expect(trips.removeMember(t.id, t.leaver, OWNER)).resolves.toBe(false);
      await expect(trips.getMemberForOwner(t.id, t.leaver, OWNER)).resolves.toBeNull();
      await expect(trips.getTripForMember(t.id, LEAVER)).resolves.toBeNull();
      // The cost stays.
      const list = await costs.listCostsForMember(t.id, OWNER);
      expect(list.costs).toHaveLength(1);
    });

    it("can't remove the owner, a guest or a spot of another trip", async () => {
      const t = await freshTrip();
      const other = await freshTrip();
      await expect(trips.removeMember(t.id, t.owner, OWNER)).resolves.toBe(false);
      await expect(trips.getMemberForOwner(t.id, t.owner, OWNER)).resolves.toBeNull();
      await expect(trips.removeMember(t.id, t.guest, OWNER)).resolves.toBe(false);
      await expect(trips.getMemberForOwner(t.id, t.guest, OWNER)).resolves.toBeNull();
      await expect(trips.removeMember(t.id, other.bea, OWNER)).resolves.toBe(false);
      expect((await spotRow(t.owner)).leftAt).toBeNull();
      expect((await spotRow(other.bea)).leftAt).toBeNull();
    });
  });

  describe("transferring ownership", () => {
    it("lets only the owner hand the trip to a person still in it", async () => {
      const t = await freshTrip();
      await expect(trips.transferOwnership(t.id, t.bea, BEA)).resolves.toBe(false);
      await expect(trips.transferOwnership(t.id, t.bea, STRANGER)).resolves.toBe(false);
      await expect(trips.transferOwnership(t.id, t.guest, OWNER)).resolves.toBe(false);
      await expect(trips.transferOwnership(t.id, t.owner, OWNER)).resolves.toBe(false);
      await trips.removeMember(t.id, t.leaver, OWNER);
      await expect(trips.transferOwnership(t.id, t.leaver, OWNER)).resolves.toBe(false);
      expect(await ownerOf(t.id)).toBe(OWNER);

      await expect(trips.transferOwnership(t.id, t.bea, OWNER)).resolves.toBe(true);
      expect(await ownerOf(t.id)).toBe(BEA);
      // The old owner stays in, but has no owner powers any more.
      await expect(trips.isTripMember(t.id, OWNER)).resolves.toBe(true);
      await expect(trips.transferOwnership(t.id, t.owner, OWNER)).resolves.toBe(false);
      await expect(trips.removeMember(t.id, t.owner, OWNER)).resolves.toBe(false);
      await expect(trips.resetInviteCode(t.id, OWNER)).resolves.toBe(false);
      // The new owner has them, and can hand the trip back.
      await expect(trips.getMemberForOwner(t.id, t.owner, BEA)).resolves.not.toBeNull();
      await expect(trips.resetInviteCode(t.id, BEA)).resolves.toBe(true);
      await expect(trips.transferOwnership(t.id, t.owner, BEA)).resolves.toBe(true);
      expect(await ownerOf(t.id)).toBe(OWNER);
    });
  });

  describe("leaving a trip", () => {
    it("lets a member leave, refuses the owner and strangers, and is not repeatable", async () => {
      const t = await freshTrip();
      await expect(trips.leaveTrip(t.id, OWNER)).resolves.toBe("owner");
      await expect(trips.leaveTrip(t.id, STRANGER)).resolves.toBe("not-found");
      await expect(trips.leaveTrip(`${ID_PREFIX}no-such-trip`, BEA)).resolves.toBe("not-found");
      await expect(trips.leaveTrip(t.id, BEA)).resolves.toBe("ok");
      expect((await spotRow(t.bea)).leftAt).not.toBeNull();
      await expect(trips.leaveTrip(t.id, BEA)).resolves.toBe("not-found");
      expect((await trips.listMyTrips(BEA)).map((row) => row.id)).not.toContain(t.id);
      expect(await ownerOf(t.id)).toBe(OWNER);
    });

    it("lets a former owner leave after handing the trip over", async () => {
      const t = await freshTrip();
      await trips.transferOwnership(t.id, t.bea, OWNER);
      await expect(trips.leaveTrip(t.id, OWNER)).resolves.toBe("ok");
      await expect(trips.leaveTrip(t.id, BEA)).resolves.toBe("owner");
    });
  });

  describe("the invite link", () => {
    it("is replaced only by the owner, and the old one opens nothing", async () => {
      const t = await freshTrip();
      await expect(trips.resetInviteCode(t.id, BEA)).resolves.toBe(false);
      await expect(trips.resetInviteCode(t.id, STRANGER)).resolves.toBe(false);
      expect(await trips.getInviteCodeForMember(t.id, OWNER)).toBe(t.inviteCode);

      await expect(trips.resetInviteCode(t.id, OWNER)).resolves.toBe(true);
      const fresh = (await trips.getInviteCodeForMember(t.id, OWNER))!;
      expect(fresh).not.toBe(t.inviteCode);
      await expect(trips.getTripByInviteCode(t.inviteCode)).resolves.toBeNull();
      await expect(trips.getTripByInviteCode(fresh)).resolves.not.toBeNull();
      await expect(trips.joinTripByInviteCode(t.inviteCode, STRANGER)).resolves.toBeNull();
      await expect(trips.isTripMember(t.id, STRANGER)).resolves.toBe(false);
    });
  });

  describe("coming back", () => {
    it("switches the same spot on again and ignores a guest pick", async () => {
      const t = await freshTrip();
      await trips.removeMember(t.id, t.leaver, OWNER);
      await expect(trips.hasLeftSpot(t.id, LEAVER)).resolves.toBe(true);
      await expect(trips.hasLeftSpot(t.id, BEA)).resolves.toBe(false);
      await expect(trips.hasLeftSpot(t.id, STRANGER)).resolves.toBe(false);

      await expect(trips.joinTripByInviteCode(t.inviteCode, LEAVER, t.guest)).resolves.toEqual({ tripId: t.id });
      expect(await spotIdOf(t.id, LEAVER)).toBe(t.leaver);
      expect((await spotRow(t.leaver)).leftAt).toBeNull();
      // The guest was not taken over.
      expect((await spotRow(t.guest)).userId).toBeNull();
      await expect(trips.hasLeftSpot(t.id, LEAVER)).resolves.toBe(false);
      await expect(trips.getTripForMember(t.id, LEAVER)).resolves.not.toBeNull();
      // Joining again changes nothing.
      await expect(trips.joinTripByInviteCode(t.inviteCode, LEAVER)).resolves.toEqual({ tripId: t.id });
    });
  });

  describe("guests are unchanged", () => {
    it("still count as no member, and removeGuest still works", async () => {
      const t = await freshTrip();
      await expect(trips.removeGuest(t.id, t.guest, OWNER)).resolves.toBe("ok");
      await expect(trips.removeGuest(t.id, t.guest, OWNER)).resolves.toBe("not-found");
    });
  });

  describe("costs keep people who left", () => {
    it("lists a person who left only for the costs they are in, and flags a payer who left", async () => {
      const t = await freshTrip();
      const input = (paidBy: string, spots: string[]) => ({
        description: "Dinner",
        amount: 30000,
        paidBy,
        category: null,
        spentOn: "2027-03-12",
        shares: money.splitEqually(30000, spots, paidBy),
      });
      await costs.createCost(t.id, OWNER, costId("with-lou"), input(t.leaver, [t.owner, t.bea, t.leaver]));
      await costs.createCost(t.id, OWNER, costId("without-lou"), input(t.owner, [t.owner, t.bea]));
      await trips.removeMember(t.id, t.leaver, OWNER);

      const ids = async (forCost: string | null, viewer = OWNER) =>
        (await trips.listCostPeople(t.id, viewer, forCost)).map((row) => row.spotId);
      expect(await ids(null)).toEqual([t.owner, t.bea, t.guest]);
      expect(await ids(costId("with-lou"))).toEqual([t.owner, t.bea, t.leaver, t.guest]);
      expect(await ids(costId("without-lou"))).toEqual([t.owner, t.bea, t.guest]);
      const people = await trips.listCostPeople(t.id, OWNER, costId("with-lou"));
      expect(people.map((row) => row.hasLeft)).toEqual([false, false, true, false]);
      await expect(trips.listCostPeople(t.id, STRANGER, costId("with-lou"))).resolves.toEqual([]);
      await expect(trips.listCostPeople(t.id, LEAVER, costId("with-lou"))).resolves.toEqual([]);

      const list = await costs.listCostsForMember(t.id, BEA);
      const byLabel = (label: string) => list.costs.find((item) => item.id === costId(label))!;
      expect(byLabel("with-lou").payer).toMatchObject({ spotId: t.leaver, hasLeft: true });
      expect(byLabel("without-lou").payer).toMatchObject({ spotId: t.owner, hasLeft: false });
    });

    it("refuses a person who left on a new cost, and keeps one already in an edited cost", async () => {
      const t = await freshTrip();
      const base = (paidBy: string, spots: string[]) => ({
        description: "Boat",
        amount: 60000,
        paidBy,
        category: null,
        spentOn: "2027-03-12",
        shares: money.splitEqually(60000, spots, paidBy),
      });
      await costs.createCost(t.id, OWNER, costId("kept"), base(t.owner, [t.owner, t.leaver]));
      await trips.removeMember(t.id, t.leaver, OWNER);

      await expect(
        costs.createCost(t.id, OWNER, costId("new-payer"), base(t.leaver, [t.owner, t.leaver])),
      ).resolves.toBe("not-found");
      await expect(
        costs.createCost(t.id, OWNER, costId("new-share"), base(t.owner, [t.owner, t.leaver])),
      ).resolves.toBe("not-found");

      const open = async () => (await costs.getCostForMember(t.id, costId("kept"), OWNER))!;
      // Keeping the person who left is fine, even as the payer.
      await expect(
        costs.updateCost(t.id, costId("kept"), OWNER, base(t.leaver, [t.owner, t.leaver]), (await open()).updatedAt),
      ).resolves.toBe("ok");
      // Taking them out works too, and then they can't be put back.
      await expect(
        costs.updateCost(t.id, costId("kept"), OWNER, base(t.owner, [t.owner, t.bea]), (await open()).updatedAt),
      ).resolves.toBe("ok");
      await expect(
        costs.updateCost(t.id, costId("kept"), OWNER, base(t.owner, [t.owner, t.leaver]), (await open()).updatedAt),
      ).resolves.toBe("changed"); // refused spots look like a changed cost, as for foreign spots
    });
  });
});
