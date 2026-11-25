import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs account deletion against the real dev database, with made-up people and trips that are
// deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as payments.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every row this test adds belongs to an id starting with ID_PREFIX, and cleanup removes only
//   those rows, including any left by an earlier run that crashed.
// - Blob is mocked: no file is ever deleted here.

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 }); // many round trips to Neon
// Plain list instead of mock history: it can't be cleared behind the test's back.
const deleted: string[][] = [];
const deleteImages = async (paths: string[]) => {
  deleted.push(paths);
};
vi.mock("@/lib/blob-store", () => ({ deleteImages }));

const ID_PREFIX = "qa-dev-account-";
const RUN = crypto.randomUUID();
const ME = `${ID_PREFIX}me-${RUN}`; // the account that gets deleted
const ADA = `${ID_PREFIX}ada-${RUN}`;
const CHO = `${ID_PREFIX}cho-${RUN}`;

const tripInput = {
  name: "Manila long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null,
};

const QR = `qr/${RUN}-me.jpg`;
const RECEIPT_ME_SHARED = `receipts/${RUN}-me-shared.jpg`;
const RECEIPT_ADA = `receipts/${RUN}-ada.jpg`;
const RECEIPT_SOLO = `receipts/${RUN}-solo.jpg`;

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

describe("account deletion on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let costs: typeof import("./costs");
  let account: typeof import("./account");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let shared: string; // owned by ME, with ADA and CHO
  let others: string; // owned by ADA, ME is a member and owes money
  let solo: string; // owned by ME, only a guest besides
  const spot: Record<string, string> = {};

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    await db.delete(schema.payment).where(like(schema.payment.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.cost).where(like(schema.cost.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.scheduleItem).where(like(schema.scheduleItem.updatedBy, `${ID_PREFIX}%`));
    await db.delete(schema.ideaVote).where(like(schema.ideaVote.userId, `${ID_PREFIX}%`));
    await db.delete(schema.idea).where(like(schema.idea.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.paymentAccount).where(like(schema.paymentAccount.userId, `${ID_PREFIX}%`));
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.addedBy, `${ID_PREFIX}%`));
    await db.delete(schema.session).where(like(schema.session.userId, `${ID_PREFIX}%`));
    await db.delete(schema.account).where(like(schema.account.userId, `${ID_PREFIX}%`));
    await db.delete(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`));
  }

  async function spotOf(tripId: string, userId: string) {
    const rows = await dbModule.db
      .select({ id: schema.tripMember.id })
      .from(schema.tripMember)
      .where(orm.and(orm.eq(schema.tripMember.tripId, tripId), orm.eq(schema.tripMember.userId, userId)));
    return rows[0]!.id;
  }

  async function addCost(
    id: string,
    tripId: string,
    amount: number,
    paidBy: string,
    shareSpots: string[],
    trashed = false,
  ) {
    const { db } = dbModule;
    const createdBy = [spot.meShared, spot.meSolo, spot.meOthers].includes(paidBy) ? ME : ADA;
    await db.insert(schema.cost).values({
      id: `${ID_PREFIX}c-${id}-${RUN}`,
      tripId,
      description: "Dinner",
      amount,
      currency: "PHP",
      paidBy,
      spentOn: "2027-03-13",
      createdBy,
      updatedBy: createdBy,
      ...(trashed ? { deletedAt: new Date(), deletedBy: createdBy } : {}),
    });
    const each = Math.floor(amount / shareSpots.length);
    await db.insert(schema.costShare).values(
      shareSpots.map((spotId, index) => ({
        costId: `${ID_PREFIX}c-${id}-${RUN}`,
        spotId,
        amount: index === 0 ? amount - each * (shareSpots.length - 1) : each,
      })),
    );
  }

  async function addPayment(
    id: string,
    tripId: string,
    fromSpot: string,
    toSpot: string,
    createdBy: string,
    amount: number,
    receiptPath: string | null,
  ) {
    await dbModule.db.insert(schema.payment).values({
      id: `${ID_PREFIX}p-${id}-${RUN}`,
      tripId,
      fromSpot,
      toSpot,
      amount,
      currency: "PHP",
      method: "cash",
      receiptPath,
      createdBy,
    });
  }

  // What the other members see of a trip's money, without names and "left" flags (those change).
  async function moneyAs(tripId: string, viewer: string) {
    const b = await costs.getBalancesForMember(tripId, viewer);
    return {
      nets: b.people.map((p) => [p.spotId, p.net]),
      payments: b.payments,
      total: b.total,
      costCount: b.costCount,
    };
  }

  async function mine() {
    const { db } = dbModule;
    const { eq } = orm;
    const [person] = await db.select().from(schema.user).where(eq(schema.user.id, ME));
    return {
      person: person!,
      sessions: await db.select().from(schema.session).where(eq(schema.session.userId, ME)),
      accounts: await db.select().from(schema.account).where(eq(schema.account.userId, ME)),
      payAccounts: await db.select().from(schema.paymentAccount).where(eq(schema.paymentAccount.userId, ME)),
      spots: await db.select().from(schema.tripMember).where(eq(schema.tripMember.userId, ME)),
      ideas: await db.select().from(schema.idea).where(eq(schema.idea.createdBy, ME)),
      votes: await db.select().from(schema.ideaVote).where(eq(schema.ideaVote.userId, ME)),
      items: await db.select().from(schema.scheduleItem).where(eq(schema.scheduleItem.updatedBy, ME)),
      payments: await db.select().from(schema.payment).where(eq(schema.payment.createdBy, ME)),
    };
  }

  const tripExists = async (id: string) =>
    (await dbModule.db.select().from(schema.trip).where(orm.eq(schema.trip.id, id))).length === 1;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", devDatabaseAddress());
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    dbModule = await import("./db");
    trips = await import("./trips");
    costs = await import("./costs");
    account = await import("./account");
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");
    const { db } = dbModule;

    await cleanUp(); // anything left by an earlier crashed run
    await db.insert(schema.user).values(
      [ME, ADA, CHO].map((id, index) => ({
        id,
        name: ["Maya Test", "Ada Test", "Cho Test"][index]!,
        email: `${id}@example.test`,
        image: id === ME ? "https://example.test/me.jpg" : null,
      })),
    );
    await db.insert(schema.session).values({
      id: `${ID_PREFIX}s-${RUN}`,
      expiresAt: new Date(Date.now() + 3600_000),
      token: `${ID_PREFIX}t-${RUN}`,
      updatedAt: new Date(),
      userId: ME,
    });
    await db.insert(schema.account).values({
      id: `${ID_PREFIX}a-${RUN}`,
      accountId: `${ID_PREFIX}g-${RUN}`,
      providerId: "google",
      userId: ME,
      updatedAt: new Date(),
    });
    await db.insert(schema.paymentAccount).values([
      { userId: ME, kind: "gcash", accountName: "Maya Test", accountNumber: "09170000000", qrPath: QR },
      { userId: ME, kind: "maya", accountName: "Maya Test", accountNumber: "09180000000" },
    ]);

    shared = await trips.createTrip(ME, tripInput);
    others = await trips.createTrip(ADA, { ...tripInput, name: "Second group trip" });
    solo = await trips.createTrip(ME, { ...tripInput, name: "My own trip" });
    await trips.joinTripByInviteCode((await trips.getInviteCodeForMember(shared, ME))!, ADA);
    await trips.joinTripByInviteCode((await trips.getInviteCodeForMember(shared, ME))!, CHO);
    await trips.joinTripByInviteCode((await trips.getInviteCodeForMember(others, ADA))!, ME);
    await trips.addGuest(solo, ME, "Gus");

    spot.meShared = await spotOf(shared, ME);
    spot.adaShared = await spotOf(shared, ADA);
    spot.choShared = await spotOf(shared, CHO);
    spot.meOthers = await spotOf(others, ME);
    spot.adaOthers = await spotOf(others, ADA);
    spot.meSolo = await spotOf(solo, ME);
    const [guest] = await db
      .select({ id: schema.tripMember.id })
      .from(schema.tripMember)
      .where(orm.and(orm.eq(schema.tripMember.tripId, solo), orm.isNotNull(schema.tripMember.guestName)));
    spot.gusSolo = guest!.id;

    // Shared trip: ME is owed money, one payment each way, each with its own receipt.
    await addCost("sh", shared, 900, spot.meShared!, [spot.meShared!, spot.adaShared!, spot.choShared!]);
    await addCost("sh2", shared, 300, spot.adaShared!, [spot.meShared!, spot.adaShared!]);
    await addPayment("sh-me", shared, spot.meShared!, spot.adaShared!, ME, 50, RECEIPT_ME_SHARED);
    await addPayment("sh-ada", shared, spot.adaShared!, spot.meShared!, ADA, 100, RECEIPT_ADA);
    // Second trip: ME owes 500, paid back 200, so still owes 300.
    await addCost("ot", others, 1000, spot.adaOthers!, [spot.adaOthers!, spot.meOthers!]);
    await addPayment("ot-me", others, spot.meOthers!, spot.adaOthers!, ME, 200, null);
    // Solo trip: a cost, a trashed cost, and a payment with a receipt, with a guest.
    await addCost("so", solo, 400, spot.meSolo!, [spot.meSolo!, spot.gusSolo!]);
    await addCost("so2", solo, 100, spot.gusSolo!, [spot.meSolo!, spot.gusSolo!], true);
    await addPayment("so", solo, spot.gusSolo!, spot.meSolo!, ME, 50, RECEIPT_SOLO);

    const [idea] = await db
      .insert(schema.idea)
      .values({ tripId: shared, name: "Street food walk", type: "food", duration: "short", createdBy: ME })
      .returning({ id: schema.idea.id });
    await db.insert(schema.ideaVote).values({ ideaId: idea!.id, userId: ME, value: 1 });
    await db.insert(schema.scheduleItem).values({
      tripId: shared,
      name: "Museum",
      day: "2027-03-13",
      slot: "full",
      updatedBy: ME,
    });
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.payment).where(like(schema.payment.createdBy, `${ID_PREFIX}%`))).toEqual([]);
  });

  it("lists what to hand over, the solo trips with cost counts, and what the person owes", async () => {
    const check = await account.getAccountDeletionCheck(ME);
    expect(check.handOver).toEqual([{ tripId: shared, name: "Manila long weekend", peopleCount: 3 }]);
    // The trashed cost counts, like it does on Delete trip.
    expect(check.soloTrips).toEqual([{ tripId: solo, name: "My own trip", costCount: 2 }]);
    // Second trip: 500 share, 200 paid back. The shared trip is not owed (ME is ahead), and the
    // solo trip is going away.
    expect(check.owing).toEqual([{ tripId: others, name: "Second group trip", amount: 300, currency: "PHP" }]);
  });

  it("refuses while a shared trip is theirs and changes nothing", async () => {
    const before = await mine();
    expect(await account.deleteAccount(ME)).toBe("owns-shared-trips");
    expect(await mine()).toEqual(before);
    expect(before.person.name).toBe("Maya Test");
    expect(before.sessions).toHaveLength(1);
    expect(before.accounts).toHaveLength(1);
    expect(before.payAccounts).toHaveLength(2);
    expect(await tripExists(solo)).toBe(true);
    expect(deleted).toEqual([]);
  });

  it("deletes after handing the shared trip over, and other members' balances do not move", async () => {
    expect(await trips.transferOwnership(shared, spot.adaShared!, ME)).toBe(true);
    expect((await account.getAccountDeletionCheck(ME)).handOver).toEqual([]);

    const sharedAda = await moneyAs(shared, ADA);
    const sharedCho = await moneyAs(shared, CHO);
    const othersAda = await moneyAs(others, ADA);
    expect(sharedAda.nets.length).toBeGreaterThan(0);

    expect(await account.deleteAccount(ME)).toBe("ok");

    expect(await moneyAs(shared, ADA)).toEqual(sharedAda);
    expect(await moneyAs(shared, CHO)).toEqual(sharedCho);
    expect(await moneyAs(others, ADA)).toEqual(othersAda);
    const after = await costs.getBalancesForMember(shared, ADA);
    const gone = after.people.find((p) => p.spotId === spot.meShared)!;
    expect(gone).toMatchObject({ name: "Former member", hasLeft: true });
  });

  it("blanks the user and removes sessions, sign-in links and payment details", async () => {
    const now = await mine();
    expect(now.person).toMatchObject({
      name: "Former member",
      email: `deleted-${ME}@deleted.invalid`,
      image: null,
      emailVerified: false,
    });
    expect(now.sessions).toEqual([]);
    expect(now.accounts).toEqual([]);
    expect(now.payAccounts).toEqual([]);
  });

  it("deletes the QR and the receipts the person uploaded, and keeps the other person's", async () => {
    expect(deleted).toHaveLength(1);
    expect([...deleted[0]!].sort()).toEqual([QR, RECEIPT_ME_SHARED, RECEIPT_SOLO].sort());
    const { db } = dbModule;
    const rows = await db
      .select({ id: schema.payment.id, path: schema.payment.receiptPath })
      .from(schema.payment)
      .where(orm.like(schema.payment.id, `${ID_PREFIX}p-%-${RUN}`));
    const byId = Object.fromEntries(rows.map((row) => [row.id, row.path]));
    expect(byId[`${ID_PREFIX}p-sh-me-${RUN}`]).toBeNull();
    expect(byId[`${ID_PREFIX}p-sh-ada-${RUN}`]).toBe(RECEIPT_ADA);
  });

  it("deletes a trip only they were in, with its costs, payments and guest", async () => {
    const { db } = dbModule;
    expect(await tripExists(solo)).toBe(false);
    for (const table of [schema.cost, schema.payment, schema.tripMember] as const) {
      expect(await db.select().from(table).where(orm.eq(table.tripId, solo))).toEqual([]);
    }
    expect(await tripExists(shared)).toBe(true);
    expect(await tripExists(others)).toBe(true);
  });

  it("marks every spot as left and keeps ideas, votes and schedule rows", async () => {
    const now = await mine();
    expect(now.spots.length).toBeGreaterThan(0);
    expect(now.spots.every((row) => row.leftAt !== null)).toBe(true);
    expect(now.ideas).toHaveLength(1);
    expect(now.votes).toHaveLength(1);
    expect(now.items).toHaveLength(1);
  });

  it("is harmless to run twice", async () => {
    const before = await mine();
    deleted.length = 0;
    expect(await account.deleteAccount(ME)).toBe("ok");
    const again = await mine();
    expect({ ...again, person: { ...again.person, updatedAt: null } }).toEqual({
      ...before,
      person: { ...before.person, updatedAt: null },
    });
    expect(deleted.flat()).toEqual([]);
  });
});
