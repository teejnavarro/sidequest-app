import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the shared-costs privacy layer against the real dev database, with made-up people and
// trips that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as trips.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every user, trip and cost this test adds has an id starting with ID_PREFIX, and cleanup
//   removes only those rows (costs and shares go with their trip), including any left by an
//   earlier run that crashed. The prefix differs from the other dev-db tests, so the files
//   don't touch each other's rows.

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-costs-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const ADDER = `${ID_PREFIX}adder-${RUN}`; // a member who adds the guests
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const JOINER = `${ID_PREFIX}joiner-${RUN}`; // later takes over a guest spot
const OWNER_TWO = `${ID_PREFIX}owner-two-${RUN}`;
const costId = (name: string) => `${ID_PREFIX}c-${name}-${RUN}`;

const tripInput = {
  name: "Manila long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null,
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

describe("shared costs on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let costs: typeof import("./costs");
  let money: typeof import("./money");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripA: string; // OWNER, ADDER, and guests Dana and Eli
  let tripB: string; // another group, owned by OWNER_TWO
  let code: string;
  let ownerSpot: string;
  let adderSpot: string;
  let dana: string;
  let eli: string;
  let otherTripSpot: string;

  const shareOf = (spots: string[], total: number, payer: string) =>
    money.splitEqually(total, spots, payer);

  function input(overrides: Partial<import("./cost-input").CostInput> = {}) {
    const spotIds = [ownerSpot, adderSpot, dana];
    return {
      description: "Dinner",
      amount: 100000,
      paidBy: ownerSpot,
      category: "food",
      spentOn: "2027-03-12",
      shares: shareOf(spotIds, 100000, ownerSpot),
      ...overrides,
    };
  }

  async function costRows(forTrip: string) {
    return dbModule.db.select().from(schema.cost).where(orm.eq(schema.cost.tripId, forTrip));
  }

  async function shareRows(id: string) {
    return dbModule.db
      .select()
      .from(schema.costShare)
      .where(orm.eq(schema.costShare.costId, id))
      .orderBy(orm.asc(schema.costShare.spotId));
  }

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    // Costs first (their shares go with them), then the trips (spots go with them), then people.
    await db.delete(schema.cost).where(like(schema.cost.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.addedBy, `${ID_PREFIX}%`));
    await db.delete(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`));
  }

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", devDatabaseAddress());
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    dbModule = await import("./db");
    trips = await import("./trips");
    costs = await import("./costs");
    money = await import("./money");
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    await dbModule.db.insert(schema.user).values(
      [OWNER, ADDER, STRANGER, JOINER, OWNER_TWO].map((id, index) => ({
        id,
        name: ["Maya Test", "Ada Test", "Lia Test", "Cho Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripA = await trips.createTrip(OWNER, tripInput);
    tripB = await trips.createTrip(OWNER_TWO, { ...tripInput, name: "Another group" });
    code = (await trips.getInviteCodeForMember(tripA, OWNER))!;
    await trips.joinTripByInviteCode(code, ADDER);
    await trips.addGuest(tripA, ADDER, "Dana");
    await trips.addGuest(tripA, ADDER, "Eli");
    const people = await trips.listTripMembers(tripA, OWNER);
    const spotNamed = (name: string) => people.find((p) => p.name === name)!.spotId;
    ownerSpot = spotNamed("Maya Test");
    adderSpot = spotNamed("Ada Test");
    dana = spotNamed("Dana");
    eli = spotNamed("Eli");
    otherTripSpot = (await trips.listTripMembers(tripB, OWNER_TWO))[0].spotId;
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.cost).where(like(schema.cost.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.costShare).where(like(schema.costShare.costId, `${ID_PREFIX}%`))).toEqual([]);
  });

  it("lets a member log a cost paid by a guest and shared with guests, and keeps the shares exact", async () => {
    const shares = shareOf([ownerSpot, adderSpot, dana, eli], 100000, dana);
    await expect(
      costs.createCost(tripA, ADDER, costId("guest-paid"), input({ paidBy: dana, shares, description: "Boat" })),
    ).resolves.toBe("ok");
    const [row] = await costRows(tripA);
    expect(row).toMatchObject({
      id: costId("guest-paid"),
      description: "Boat",
      amount: 100000,
      currency: "PHP",
      paidBy: dana,
      category: "food",
      spentOn: "2027-03-12",
      createdBy: ADDER,
      updatedBy: ADDER,
    });
    const saved = await shareRows(costId("guest-paid"));
    expect(saved.map((s) => s.spotId).sort()).toEqual([ownerSpot, adderSpot, dana, eli].sort());
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
    expect(saved.find((s) => s.spotId === dana)?.amount).toBe(25000);
  });

  it("gives the extra centavo to the payer and keeps every share adding up", async () => {
    await costs.createCost(tripA, OWNER, costId("thirds"), input());
    const saved = await shareRows(costId("thirds"));
    expect(saved.find((s) => s.spotId === ownerSpot)?.amount).toBe(33334);
    expect(saved.find((s) => s.spotId === adderSpot)?.amount).toBe(33333);
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
  });

  it("refuses a stranger, a made-up trip and a spot from another trip, saving nothing", async () => {
    const before = (await costRows(tripA)).length;
    await expect(costs.createCost(tripA, STRANGER, costId("sneaky"), input())).resolves.toBe("not-found");
    await expect(costs.createCost(`${ID_PREFIX}no-such-trip`, OWNER, costId("ghost"), input())).resolves.toBe("not-found");
    await expect(
      costs.createCost(tripA, OWNER, costId("foreign-payer"), input({ paidBy: otherTripSpot })),
    ).resolves.toBe("not-found");
    await expect(
      costs.createCost(
        tripA,
        OWNER,
        costId("foreign-share"),
        input({ shares: [{ spotId: ownerSpot, amount: 50000 }, { spotId: otherTripSpot, amount: 50000 }] }),
      ),
    ).resolves.toBe("not-found");
    expect((await costRows(tripA)).length).toBe(before);
    expect(await shareRows(costId("foreign-share"))).toEqual([]);
  });

  it("saves once when the same save is sent twice, even at the same moment", async () => {
    const id = costId("double");
    const results = await Promise.all([
      costs.createCost(tripA, OWNER, id, input({ description: "Taxi" })),
      costs.createCost(tripA, OWNER, id, input({ description: "Taxi" })),
    ]);
    expect(results).toEqual(["ok", "ok"]);
    await expect(costs.createCost(tripA, OWNER, id, input({ description: "Taxi" }))).resolves.toBe("ok");
    expect((await costRows(tripA)).filter((r) => r.id === id)).toHaveLength(1);
    const saved = await shareRows(id);
    expect(saved).toHaveLength(3);
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
  });

  it("does not let a reused id change a cost, or let someone else take the id", async () => {
    const id = costId("double");
    // Same id, different people and amounts: nothing changes.
    await costs.createCost(
      tripA,
      OWNER,
      id,
      input({ description: "Hijack", amount: 5, shares: [{ spotId: eli, amount: 5 }] }),
    );
    const [row] = (await costRows(tripA)).filter((r) => r.id === id);
    expect(row).toMatchObject({ description: "Taxi", amount: 100000 });
    expect(await shareRows(id)).toHaveLength(3);
    // Another member sending an id that exists is not told it saved.
    await expect(costs.createCost(tripA, ADDER, id, input())).resolves.toBe("not-found");
  });

  it("lists costs newest day first with the viewer's share, payer and who added and edited, no email", async () => {
    await costs.createCost(tripA, OWNER, costId("later"), input({ description: "Souvenirs", spentOn: "2027-03-14", amount: 25050, shares: shareOf([ownerSpot, adderSpot], 25050, adderSpot), paidBy: adderSpot }));
    const list = await costs.listCostsForMember(tripA, OWNER);
    const days = list.costs.map((c) => c.spentOn);
    expect(days).toEqual([...days].sort().reverse());
    expect(list.costs[0]).toMatchObject({
      description: "Souvenirs",
      amount: 25050,
      shareCount: 2,
      myShare: 12525,
      payer: { name: "Ada Test", isGuest: false, isYou: false },
      addedBy: "Maya",
      editedBy: null,
    });
    expect(list.total).toBe(list.costs.reduce((sum, c) => sum + c.amount, 0));
    const boat = list.costs.find((c) => c.id === costId("guest-paid"))!;
    expect(boat).toMatchObject({ payer: { name: "Dana", isGuest: true }, addedBy: "Ada", shareCount: 4, myShare: 25000 });
    // Someone not in a cost sees null for their share.
    const mineOnly = await costs.listCostsForMember(tripA, ADDER);
    expect(mineOnly.costs.find((c) => c.id === costId("guest-paid"))?.payer.isYou).toBe(false);
    expect(JSON.stringify(list)).not.toContain("@example.test");
    await expect(costs.listCostsForMember(tripA, STRANGER)).resolves.toEqual({ costs: [], total: 0 });
    await expect(costs.listCostsForMember(tripB, OWNER)).resolves.toEqual({ costs: [], total: 0 });
  });

  it("opens one cost for a member only, with its shares", async () => {
    const found = await costs.getCostForMember(tripA, costId("thirds"), ADDER);
    expect(found).toMatchObject({ id: costId("thirds"), amount: 100000, paidBy: ownerSpot, currency: "PHP" });
    expect(found?.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
    expect(found?.updatedAt).toBeInstanceOf(Date);
    await expect(costs.getCostForMember(tripA, costId("thirds"), STRANGER)).resolves.toBeNull();
    await expect(costs.getCostForMember(tripB, costId("thirds"), OWNER_TWO)).resolves.toBeNull();
    await expect(costs.getCostForMember(tripA, `${ID_PREFIX}no-such-cost`, OWNER)).resolves.toBeNull();
  });

  it("edits with the saved time, replaces the shares, and records who edited", async () => {
    const id = costId("thirds");
    const opened = (await costs.getCostForMember(tripA, id, ADDER))!;
    const next = input({
      description: "Dinner and drinks",
      amount: 350000,
      shares: shareOf([ownerSpot, adderSpot], 350000, ownerSpot),
      category: null,
    });
    await expect(costs.updateCost(tripA, id, ADDER, next, opened.updatedAt)).resolves.toBe("ok");
    const [row] = (await costRows(tripA)).filter((r) => r.id === id);
    expect(row).toMatchObject({ description: "Dinner and drinks", amount: 350000, category: null, createdBy: OWNER, updatedBy: ADDER });
    const saved = await shareRows(id);
    expect(saved.map((s) => s.spotId).sort()).toEqual([ownerSpot, adderSpot].sort());
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(350000);
    const listed = (await costs.listCostsForMember(tripA, OWNER)).costs.find((c) => c.id === id);
    expect(listed).toMatchObject({ addedBy: "Maya", editedBy: "Ada", shareCount: 2 });
  });

  it("refuses an edit made from an old copy, and changes nothing", async () => {
    const id = costId("thirds");
    const opened = (await costs.getCostForMember(tripA, id, OWNER))!;
    // Someone saves first...
    await expect(
      costs.updateCost(tripA, id, ADDER, input({ description: "Changed first", amount: 400000, shares: shareOf([ownerSpot, adderSpot], 400000, ownerSpot) }), opened.updatedAt),
    ).resolves.toBe("ok");
    // ...so the copy opened earlier is stale.
    await expect(
      costs.updateCost(tripA, id, OWNER, input({ description: "Late save", amount: 1000, shares: shareOf([ownerSpot], 1000, ownerSpot) }), opened.updatedAt),
    ).resolves.toBe("changed");
    const [row] = (await costRows(tripA)).filter((r) => r.id === id);
    expect(row).toMatchObject({ description: "Changed first", amount: 400000, updatedBy: ADDER });
    const saved = await shareRows(id);
    expect(saved).toHaveLength(2);
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(400000);
    // Opening it again gives a copy that saves.
    const fresh = (await costs.getCostForMember(tripA, id, OWNER))!;
    await expect(costs.updateCost(tripA, id, OWNER, input({ description: "Second look" }), fresh.updatedAt)).resolves.toBe("ok");
    // The same copy twice: the second save is stale.
    await expect(costs.updateCost(tripA, id, OWNER, input({ description: "Again" }), fresh.updatedAt)).resolves.toBe("changed");
  });

  it("refuses an edit by a stranger or to a cost in another trip, and one with a foreign spot", async () => {
    const id = costId("thirds");
    const opened = (await costs.getCostForMember(tripA, id, OWNER))!;
    await expect(costs.updateCost(tripA, id, STRANGER, input({ description: "Nope" }), opened.updatedAt)).resolves.toBe("not-found");
    await expect(costs.updateCost(tripB, id, OWNER_TWO, input({ description: "Nope" }), opened.updatedAt)).resolves.toBe("not-found");
    await expect(
      costs.updateCost(tripA, id, OWNER, input({ paidBy: otherTripSpot, description: "Nope" }), opened.updatedAt),
    ).resolves.toBe("changed");
    await expect(costs.updateCost(tripA, `${ID_PREFIX}no-such-cost`, OWNER, input(), opened.updatedAt)).resolves.toBe("not-found");
    const [row] = (await costRows(tripA)).filter((r) => r.id === id);
    expect(row.description).toBe("Second look");
    expect(await shareRows(id)).toHaveLength(3);
  });

  it("counts a trip's costs for members only", async () => {
    const rows = await costRows(tripA);
    await expect(costs.countCostsForTrip(tripA, OWNER)).resolves.toBe(rows.length);
    await expect(costs.countCostsForTrip(tripA, STRANGER)).resolves.toBe(0);
    await expect(costs.countCostsForTrip(tripB, OWNER_TWO)).resolves.toBe(0);
  });

  it("keeps a guest who is in a cost from being removed, in the app and in the database", async () => {
    // Dana paid one cost and shares others; Eli shares one cost; a new guest is in none.
    await expect(trips.getGuestForEditor(tripA, dana, ADDER)).resolves.toMatchObject({ costCount: expect.any(Number) });
    expect((await trips.getGuestForEditor(tripA, dana, ADDER))!.costCount).toBeGreaterThanOrEqual(2);
    await expect(trips.removeGuest(tripA, dana, ADDER)).resolves.toBe("in-costs");
    await expect(trips.removeGuest(tripA, dana, OWNER)).resolves.toBe("in-costs");
    await expect(trips.removeGuest(tripA, dana, STRANGER)).resolves.toBe("not-found");
    // Even a direct delete is refused by the database.
    await expect(
      dbModule.db.delete(schema.tripMember).where(orm.eq(schema.tripMember.id, dana)),
    ).rejects.toThrow();
    expect((await trips.listTripMembers(tripA, OWNER)).some((p) => p.spotId === dana)).toBe(true);

    await trips.addGuest(tripA, ADDER, "Temp Guest");
    const temp = (await trips.listTripMembers(tripA, OWNER)).find((p) => p.name === "Temp Guest")!.spotId;
    await expect(trips.getGuestForEditor(tripA, temp, ADDER)).resolves.toMatchObject({ costCount: 0 });
    await expect(trips.removeGuest(tripA, temp, ADDER)).resolves.toBe("ok");
  });

  it("lets a guest be removed once the cost they were in is deleted", async () => {
    await trips.addGuest(tripA, ADDER, "Pass Through");
    const pass = (await trips.listTripMembers(tripA, OWNER)).find((p) => p.name === "Pass Through")!.spotId;
    const id = costId("pass");
    await costs.createCost(tripA, OWNER, id, input({ shares: shareOf([ownerSpot, pass], 100000, ownerSpot) }));
    await expect(trips.removeGuest(tripA, pass, ADDER)).resolves.toBe("in-costs");
    await expect(costs.deleteCost(tripA, id, OWNER)).resolves.toBe(true);
    await expect(trips.removeGuest(tripA, pass, ADDER)).resolves.toBe("ok");
  });

  it("deletes a cost and its shares for any member, and nobody else", async () => {
    const id = costId("delete-me");
    await costs.createCost(tripA, OWNER, id, input({ description: "Delete me" }));
    expect(await shareRows(id)).toHaveLength(3);
    await expect(costs.deleteCost(tripA, id, STRANGER)).resolves.toBe(false);
    await expect(costs.deleteCost(tripB, id, OWNER_TWO)).resolves.toBe(false);
    expect(await shareRows(id)).toHaveLength(3);
    await expect(costs.deleteCost(tripA, id, ADDER)).resolves.toBe(true); // not who added it
    expect(await shareRows(id)).toEqual([]);
    expect((await costRows(tripA)).some((r) => r.id === id)).toBe(false);
    await expect(costs.deleteCost(tripA, id, ADDER)).resolves.toBe(false); // harmless twice
  });

  it("lets only one of two saves from the same copy win, even at the same moment", async () => {
    const id = costId("race");
    await costs.createCost(tripA, OWNER, id, input({ description: "Race" }));
    const opened = (await costs.getCostForMember(tripA, id, OWNER))!;
    const fromOwner = { description: "From owner", amount: 90000, spots: [ownerSpot, adderSpot, dana] };
    const fromAdder = { description: "From adder", amount: 1001, spots: [adderSpot, eli] };
    const results = await Promise.all([
      costs.updateCost(tripA, id, OWNER, input({ description: fromOwner.description, amount: fromOwner.amount, shares: shareOf(fromOwner.spots, fromOwner.amount, ownerSpot) }), opened.updatedAt),
      costs.updateCost(tripA, id, ADDER, input({ description: fromAdder.description, amount: fromAdder.amount, paidBy: adderSpot, shares: shareOf(fromAdder.spots, fromAdder.amount, adderSpot) }), opened.updatedAt),
    ]);
    expect([...results].sort()).toEqual(["changed", "ok"]);
    const winner = results[0] === "ok" ? fromOwner : fromAdder;
    const [row] = (await costRows(tripA)).filter((r) => r.id === id);
    expect(row).toMatchObject({ description: winner.description, amount: winner.amount });
    // The loser's shares never mix in: the shares are exactly the winner's and add up.
    const saved = await shareRows(id);
    expect(saved.map((s) => s.spotId).sort()).toEqual([...winner.spots].sort());
    expect(saved.reduce((sum, s) => sum + s.amount, 0)).toBe(winner.amount);
  });

  it("refuses to remove a guest who only shares a cost or only paid one, until they are taken out", async () => {
    await trips.addGuest(tripA, ADDER, "Sharer Only");
    await trips.addGuest(tripA, ADDER, "Payer Only");
    const people = await trips.listTripMembers(tripA, OWNER);
    const sharer = people.find((p) => p.name === "Sharer Only")!.spotId;
    const payer = people.find((p) => p.name === "Payer Only")!.spotId;
    const sharerCost = costId("sharer-only");
    await costs.createCost(tripA, OWNER, sharerCost, input({ amount: 1000, shares: shareOf([ownerSpot, sharer], 1000, ownerSpot) }));
    await costs.createCost(tripA, OWNER, costId("payer-only"), input({ amount: 1000, paidBy: payer, shares: shareOf([ownerSpot, adderSpot], 1000, payer) }));
    for (const spot of [sharer, payer]) {
      expect((await trips.getGuestForEditor(tripA, spot, ADDER))?.costCount).toBe(1);
      await expect(trips.removeGuest(tripA, spot, ADDER)).resolves.toBe("in-costs");
    }
    // An edit that takes the sharer out of their only cost frees them.
    const opened = (await costs.getCostForMember(tripA, sharerCost, OWNER))!;
    await expect(
      costs.updateCost(tripA, sharerCost, OWNER, input({ amount: 1000, shares: shareOf([ownerSpot], 1000, ownerSpot) }), opened.updatedAt),
    ).resolves.toBe("ok");
    await expect(trips.getGuestForEditor(tripA, sharer, ADDER)).resolves.toMatchObject({ costCount: 0 });
    await expect(trips.removeGuest(tripA, sharer, ADDER)).resolves.toBe("ok");
    await expect(trips.removeGuest(tripA, payer, ADDER)).resolves.toBe("in-costs");
  });

  it("has the database refuse a zero cost or a negative share, as a last line of defence", async () => {
    await expect(
      dbModule.db.insert(schema.cost).values({
        id: costId("zero"),
        tripId: tripA,
        description: "Zero",
        amount: 0,
        currency: "PHP",
        paidBy: ownerSpot,
        spentOn: "2027-03-12",
        createdBy: OWNER,
        updatedBy: OWNER,
      }),
    ).rejects.toThrow();
    await expect(
      dbModule.db.insert(schema.costShare).values({ costId: costId("thirds"), spotId: eli, amount: -1 }),
    ).rejects.toThrow();
    expect((await shareRows(costId("thirds"))).some((s) => s.spotId === eli)).toBe(false);
  });

  it("lets only the owner delete a trip with costs: a member or stranger leaves every cost and share", async () => {
    const before = await costRows(tripA);
    expect(before.length).toBeGreaterThan(0);
    const sharesBefore = (await Promise.all(before.map((r) => shareRows(r.id)))).flat().length;
    await expect(trips.deleteTripForOwner(tripA, ADDER)).resolves.toBe(false);
    await expect(trips.deleteTripForOwner(tripA, STRANGER)).resolves.toBe(false);
    await expect(trips.deleteTripForOwner(tripA, OWNER_TWO)).resolves.toBe(false);
    const after = await costRows(tripA);
    expect(after).toHaveLength(before.length);
    expect((await Promise.all(after.map((r) => shareRows(r.id)))).flat()).toHaveLength(sharesBefore);
  });

  it("keeps every cost and share when a guest's spot is claimed", async () => {
    const before = await costs.listCostsForMember(tripA, OWNER);
    const danaCosts = before.costs.filter((c) => c.payer.spotId === dana || c.id === costId("guest-paid"));
    expect(danaCosts.length).toBeGreaterThan(0);
    await expect(trips.joinTripByInviteCode(code, JOINER, dana)).resolves.toEqual({ tripId: tripA });

    const after = await costs.listCostsForMember(tripA, JOINER);
    expect(after.total).toBe(before.total);
    const boat = after.costs.find((c) => c.id === costId("guest-paid"))!;
    expect(boat).toMatchObject({ payer: { spotId: dana, name: "Cho Test", isGuest: false, isYou: true }, myShare: 25000 });
    // The spot is a person now, so it is no longer a guest to edit.
    await expect(trips.getGuestForEditor(tripA, dana, ADDER)).resolves.toBeNull();
  });

  it("removes a trip's costs and shares when the trip is deleted", async () => {
    const id = costId("with-trip");
    await costs.createCost(tripB, OWNER_TWO, id, {
      description: "Group dinner",
      amount: 5000,
      paidBy: otherTripSpot,
      category: null,
      spentOn: "2027-03-12",
      shares: [{ spotId: otherTripSpot, amount: 5000 }],
    });
    expect(await shareRows(id)).toHaveLength(1);
    await expect(trips.deleteTripForOwner(tripB, OWNER_TWO)).resolves.toBe(true);
    expect(await costRows(tripB)).toEqual([]);
    expect(await shareRows(id)).toEqual([]);

    const gone = await trips.deleteTripForOwner(tripA, OWNER);
    expect(gone).toBe(true);
    expect(await costRows(tripA)).toEqual([]);
    expect(await shareRows(costId("guest-paid"))).toEqual([]);
  });
});
