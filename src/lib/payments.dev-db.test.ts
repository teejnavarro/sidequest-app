import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the payment details and payments privacy layer against the real dev database, with
// made-up people and trips that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as costs.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every user, trip, account and payment this test adds has an id starting with ID_PREFIX, and
//   cleanup removes only those rows, including any left by an earlier run that crashed. The
//   prefix differs from the other dev-db tests, so the files don't touch each other rows.
// - Blob is mocked: no file is ever uploaded or deleted here.

vi.mock("server-only", () => ({}));
const deleteImages = vi.fn<(paths: string[]) => Promise<void>>(async () => {});
// The image routes read the file through readImage; here any path gives three JPEG bytes, so
// the routes' answers depend only on the real privacy queries.
const readImage = vi.fn<(path: string) => Promise<{ stream: ReadableStream<Uint8Array> }>>(async () => ({
  stream: new Response(new Uint8Array([0xff, 0xd8, 0xff])).body!,
}));
vi.mock("./blob-store", () => ({ deleteImages, readImage }));
// The signed-in person for the image routes.
let signedIn = "";
vi.mock("./current-user", () => ({
  getCurrentUser: async () => ({ id: signedIn, name: "Test", image: null }),
}));

const ID_PREFIX = "qa-dev-pay-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const MEMBER = `${ID_PREFIX}member-${RUN}`; // in OWNER trips
const THIRD = `${ID_PREFIX}third-${RUN}`; // in OWNER first trip, not a party to payments
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const OTHER_OWNER = `${ID_PREFIX}other-owner-${RUN}`;

const tripInput = {
  name: "Manila long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null,
};

const wallet = { kind: "gcash", accountName: "Maya Test", number: "09171234567" } as const;
const bank = { kind: "bank", bankName: "BDO", accountName: "Maya Test", number: "001234567890" } as const;

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

describe("payments on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let payments: typeof import("./payments");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripA: string; // OWNER, MEMBER, THIRD
  let tripB: string; // OWNER, MEMBER
  let codeA: string;
  let codeB: string;

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    await db.delete(schema.payment).where(like(schema.payment.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.cost).where(like(schema.cost.createdBy, `${ID_PREFIX}%`));
    await db.delete(schema.paymentAccount).where(like(schema.paymentAccount.userId, `${ID_PREFIX}%`));
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.addedBy, `${ID_PREFIX}%`));
    await db.delete(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`));
  }

  async function clearAccounts(userId: string) {
    await dbModule.db.delete(schema.paymentAccount).where(orm.eq(schema.paymentAccount.userId, userId));
  }

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", devDatabaseAddress());
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    dbModule = await import("./db");
    trips = await import("./trips");
    payments = await import("./payments");
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    await cleanUp(); // anything left by an earlier crashed run
    await dbModule.db.insert(schema.user).values(
      [OWNER, MEMBER, THIRD, STRANGER, OTHER_OWNER].map((id, index) => ({
        id,
        name: ["Maya Test", "Ada Test", "Cho Test", "Lia Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripA = await trips.createTrip(OWNER, tripInput);
    tripB = await trips.createTrip(OWNER, { ...tripInput, name: "Second trip" });
    await trips.createTrip(OTHER_OWNER, { ...tripInput, name: "Another group" });
    codeA = (await trips.getInviteCodeForMember(tripA, OWNER))!;
    codeB = (await trips.getInviteCodeForMember(tripB, OWNER))!;
    await trips.joinTripByInviteCode(codeA, MEMBER);
    await trips.joinTripByInviteCode(codeA, THIRD);
    await trips.joinTripByInviteCode(codeB, MEMBER);
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.paymentAccount).where(like(schema.paymentAccount.userId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.payment).where(like(schema.payment.createdBy, `${ID_PREFIX}%`))).toEqual([]);
  });

  describe("payment details", () => {
    it("lets the owner add, list, read, edit and delete their own accounts", async () => {
      await clearAccounts(OWNER);
      expect(await payments.createPaymentAccount(OWNER, wallet, "qr/a.jpg")).toBe("ok");
      expect(await payments.createPaymentAccount(OWNER, bank, null)).toBe("ok");
      const mine = await payments.listMyPaymentAccounts(OWNER);
      expect(mine).toHaveLength(2);
      expect(mine[0]).toMatchObject({ kind: "gcash", bankName: null, number: "09171234567", hasQr: true });
      expect(mine[1]).toMatchObject({ kind: "bank", bankName: "BDO", hasQr: false });
      // The stored file name never comes back from a list.
      expect(JSON.stringify(mine)).not.toContain("qr/a.jpg");
      expect(await payments.getMyPaymentAccount(OWNER, mine[0]!.id)).toMatchObject({ id: mine[0]!.id });

      const edit = { ...wallet, kind: "maya", accountName: "Maya T" } as const;
      expect(await payments.updatePaymentAccount(OWNER, mine[0]!.id, edit, { mode: "keep" })).toEqual({ oldQrPath: null });
      expect(await payments.getMyPaymentAccount(OWNER, mine[0]!.id)).toMatchObject({ kind: "maya", accountName: "Maya T", hasQr: true });
      expect(await payments.updatePaymentAccount(OWNER, mine[0]!.id, edit, { mode: "replace", path: "qr/b.jpg" })).toEqual({ oldQrPath: "qr/a.jpg" });
      expect(await payments.updatePaymentAccount(OWNER, mine[0]!.id, edit, { mode: "remove" })).toEqual({ oldQrPath: "qr/b.jpg" });
      expect(await payments.getMyPaymentAccount(OWNER, mine[0]!.id)).toMatchObject({ hasQr: false });
      // Changing a bank account into a wallet drops the bank name.
      expect(await payments.updatePaymentAccount(OWNER, mine[1]!.id, wallet, { mode: "keep" })).toEqual({ oldQrPath: null });
      expect(await payments.getMyPaymentAccount(OWNER, mine[1]!.id)).toMatchObject({ kind: "gcash", bankName: null });

      expect(await payments.deletePaymentAccount(OWNER, mine[1]!.id)).toEqual({ qrPath: null });
      expect(await payments.listMyPaymentAccounts(OWNER)).toHaveLength(1);
      await clearAccounts(OWNER);
    });

    it("shows an account to a member of a shared trip, with the full number, and to nobody else", async () => {
      await clearAccounts(OWNER);
      await payments.createPaymentAccount(OWNER, wallet, "qr/owner.jpg");
      const [account] = await payments.listMyPaymentAccounts(OWNER);
      const seen = await payments.listPaymentAccountsForViewer(OWNER, MEMBER);
      expect(seen).toEqual([account]);
      expect(seen[0]!.number).toBe("09171234567");
      expect(await payments.getQrForViewer(account!.id, MEMBER)).toBe("qr/owner.jpg");
      expect(await payments.getQrForViewer(account!.id, OWNER)).toBe("qr/owner.jpg");

      expect(await payments.listPaymentAccountsForViewer(OWNER, STRANGER)).toEqual([]);
      expect(await payments.listPaymentAccountsForViewer(OWNER, OTHER_OWNER)).toEqual([]);
      expect(await payments.getQrForViewer(account!.id, STRANGER)).toBeNull();
      expect(await payments.getQrForViewer(`${ID_PREFIX}missing`, MEMBER)).toBeNull();
      // Looking up another person account under your own name shows nothing.
      expect(await payments.listPaymentAccountsForViewer(MEMBER, OWNER)).toEqual([]);
    });

    it("stops showing details the moment someone leaves or is removed, and again after rejoining", async () => {
      const [account] = await payments.listMyPaymentAccounts(OWNER);

      // THIRD is only in trip A. Leaving ends access at once.
      expect(await payments.listPaymentAccountsForViewer(OWNER, THIRD)).toEqual([account]);
      expect(await trips.leaveTrip(tripA, THIRD)).toBe("ok");
      expect(await payments.listPaymentAccountsForViewer(OWNER, THIRD)).toEqual([]);
      expect(await payments.getQrForViewer(account!.id, THIRD)).toBeNull();
      await trips.joinTripByInviteCode(codeA, THIRD);
      expect(await payments.listPaymentAccountsForViewer(OWNER, THIRD)).toEqual([account]);

      // Removed by the owner: same.
      const spot = (await trips.listTripMembers(tripA, OWNER)).find((p) => p.name === "Cho Test")!.spotId;
      expect(await trips.removeMember(tripA, spot, OWNER)).toBe(true);
      expect(await payments.listPaymentAccountsForViewer(OWNER, THIRD)).toEqual([]);
      expect(await payments.getQrForViewer(account!.id, THIRD)).toBeNull();
      await trips.joinTripByInviteCode(codeA, THIRD);
      expect(await payments.listPaymentAccountsForViewer(OWNER, THIRD)).toEqual([account]);
    });

    it("keeps access while one of two shared trips remains", async () => {
      const [account] = await payments.listMyPaymentAccounts(OWNER);
      expect(await trips.leaveTrip(tripA, MEMBER)).toBe("ok");
      expect(await payments.listPaymentAccountsForViewer(OWNER, MEMBER)).toEqual([account]); // trip B
      expect(await trips.leaveTrip(tripB, MEMBER)).toBe("ok");
      expect(await payments.listPaymentAccountsForViewer(OWNER, MEMBER)).toEqual([]);
      await trips.joinTripByInviteCode(codeA, MEMBER);
      await trips.joinTripByInviteCode(codeB, MEMBER);
      expect(await payments.listPaymentAccountsForViewer(OWNER, MEMBER)).toEqual([account]);
    });

    it("lets nobody else change or delete an account", async () => {
      const [account] = await payments.listMyPaymentAccounts(OWNER);
      for (const other of [MEMBER, STRANGER]) {
        expect(await payments.updatePaymentAccount(other, account!.id, bank, { mode: "remove" })).toBe("not-found");
        expect(await payments.deletePaymentAccount(other, account!.id)).toBe("not-found");
        expect(await payments.getMyPaymentAccount(other, account!.id)).toBeNull();
      }
      expect(await payments.listMyPaymentAccounts(OWNER)).toEqual([account]);
      expect((await payments.listMyPaymentAccounts(OWNER))[0]!.hasQr).toBe(true);
    });

    it("stops at 10 accounts per person", async () => {
      await clearAccounts(STRANGER);
      for (let i = 0; i < 10; i++) {
        expect(await payments.createPaymentAccount(STRANGER, wallet, null)).toBe("ok");
      }
      expect(await payments.createPaymentAccount(STRANGER, wallet, null)).toBe("too-many");
      expect(await payments.listMyPaymentAccounts(STRANGER)).toHaveLength(10);
      // Another person count is separate, and deleting one makes room.
      expect(await payments.createPaymentAccount(OTHER_OWNER, wallet, null)).toBe("ok");
      const [first] = await payments.listMyPaymentAccounts(STRANGER);
      await payments.deletePaymentAccount(STRANGER, first!.id);
      expect(await payments.createPaymentAccount(STRANGER, wallet, null)).toBe("ok");
      await clearAccounts(STRANGER);
      await clearAccounts(OTHER_OWNER);
    });
  });

  describe("recording and reading payments", () => {
    let tripP: string; // OWNER, MEMBER, THIRD, guests Dana and Eli
    let codeP: string;
    let ownerSpot: string;
    let memberSpot: string;
    let thirdSpot: string;
    let dana: string;
    let eli: string;
    let costs: typeof import("./costs");
    let money: typeof import("./money");
    const pid = (name: string) => `${ID_PREFIX}p-${name}-${RUN}`;

    const record = (
      id: string,
      userId: string,
      fromSpot: string,
      toSpot: string,
      amount: number,
      extra: { receiptPath?: string | null; method?: "gcash" | "maya" | "bank" | "cash" } = {},
    ) =>
      payments.recordPayment({
        tripId: tripP,
        paymentId: pid(id),
        fromSpot,
        toSpot,
        amount,
        method: extra.method ?? "gcash",
        receiptPath: extra.receiptPath ?? null,
        userId,
      });

    const netOf = async (viewer: string) =>
      Object.fromEntries((await costs.getBalancesForMember(tripP, viewer)).people.map((p) => [p.spotId, p.net]));

    async function paymentRows() {
      return dbModule.db.select().from(schema.payment).where(orm.eq(schema.payment.tripId, tripP));
    }

    beforeAll(async () => {
      costs = await import("./costs");
      money = await import("./money");
      tripP = await trips.createTrip(OWNER, { ...tripInput, name: "Payments trip" });
      codeP = (await trips.getInviteCodeForMember(tripP, OWNER))!;
      await trips.joinTripByInviteCode(codeP, MEMBER);
      await trips.joinTripByInviteCode(codeP, THIRD);
      await trips.addGuest(tripP, OWNER, "Dana");
      await trips.addGuest(tripP, OWNER, "Eli");
      const people = await trips.listTripMembers(tripP, OWNER);
      const spotNamed = (name: string) => people.find((p) => p.name === name)!.spotId;
      ownerSpot = spotNamed("Maya Test");
      memberSpot = spotNamed("Ada Test");
      thirdSpot = spotNamed("Cho Test");
      dana = spotNamed("Dana");
      eli = spotNamed("Eli");
      // OWNER paid 90,000 centavos shared by OWNER, MEMBER and Dana: OWNER +60000, MEMBER -30000, Dana -30000.
      const spots = [ownerSpot, memberSpot, dana];
      const shares = money.splitEqually(90000, spots, ownerSpot).map((share) => ({ ...share, originalAmount: null }));
      await costs.createCost(tripP, OWNER, `${ID_PREFIX}c-pay-${RUN}`, {
        description: "Dinner",
        amount: 90000,
        paidBy: ownerSpot,
        category: "food",
        spentOn: "2027-03-12",
        shares,
        money: { kind: "trip" as const },
      });
    });

    it("lets the payer and the receiver record, and moves balances by the amount", async () => {
      expect(await netOf(OWNER)).toMatchObject({ [ownerSpot]: 60000, [memberSpot]: -30000, [dana]: -30000 });
      expect(await record("payer", MEMBER, memberSpot, ownerSpot, 10000)).toBe("ok");
      expect(await record("receiver", OWNER, memberSpot, ownerSpot, 5000, { method: "cash" })).toBe("ok");
      const nets = await netOf(THIRD);
      expect(nets[ownerSpot]).toBe(60000 - 15000);
      expect(nets[memberSpot]).toBe(-30000 + 15000);
      expect(Object.values(nets).reduce((sum, n) => sum + n, 0)).toBe(0);
      const rows = await paymentRows();
      expect(rows.map((r) => r.currency)).toEqual(["PHP", "PHP"]);
      const line = (await costs.getBalancesForMember(tripP, OWNER)).payments.find((p) => p.from === memberSpot && p.to === ownerSpot);
      expect(line?.amount).toBe(15000);
    });

    it("refuses a third member and a stranger, saving nothing", async () => {
      const before = (await paymentRows()).length;
      expect(await record("third", THIRD, memberSpot, ownerSpot, 100)).toBe("not-allowed");
      expect(await record("stranger", STRANGER, memberSpot, ownerSpot, 100)).toBe("not-allowed");
      expect(await record("same-spot", OWNER, ownerSpot, ownerSpot, 100)).toBe("not-allowed");
      expect(await record("zero", OWNER, memberSpot, ownerSpot, 0)).toBe("not-allowed");
      expect(await record("foreign", OWNER, memberSpot, `${ID_PREFIX}no-such-spot`, 100)).toBe("not-allowed");
      expect((await paymentRows()).length).toBe(before);
    });

    it("lets one side record a payment with a guest on the other side, and refuses guest to guest", async () => {
      expect(await record("to-guest", OWNER, ownerSpot, dana, 1000)).toBe("ok");
      expect(await record("from-guest", OWNER, dana, ownerSpot, 2000)).toBe("ok");
      expect(await record("guest-guest", OWNER, dana, eli, 100)).toBe("not-allowed");
      expect(await record("guest-guest-third", THIRD, dana, eli, 100)).toBe("not-allowed");
    });

    it("stores one row when the same id is saved twice", async () => {
      const id = "twice";
      expect(await record(id, MEMBER, memberSpot, ownerSpot, 700)).toBe("ok");
      expect(await record(id, MEMBER, memberSpot, ownerSpot, 700)).toBe("repeat");
      const rows = (await paymentRows()).filter((r) => r.id === pid(id));
      expect(rows).toHaveLength(1);
      // Someone else cannot use that id, and a repeat does not reveal it to them.
      expect(await record(id, THIRD, memberSpot, ownerSpot, 700)).toBe("not-allowed");
    });

    it("ignores a payment in another currency in the balances", async () => {
      const before = await netOf(OWNER);
      await dbModule.db.insert(schema.payment).values({
        id: pid("usd"),
        tripId: tripP,
        fromSpot: memberSpot,
        toSpot: ownerSpot,
        amount: 99999,
        currency: "USD",
        method: "bank",
        createdBy: MEMBER,
      });
      expect(await netOf(OWNER)).toEqual(before);
      expect((await payments.listPaymentsForMember(tripP, OWNER)).some((p) => p.id === pid("usd"))).toBe(false);
    });

    it("shows a receipt only to the payer and the receiver", async () => {
      expect(await record("receipt", MEMBER, memberSpot, ownerSpot, 300, { receiptPath: "receipts/r.jpg" })).toBe("ok");
      for (const party of [MEMBER, OWNER]) {
        const item = (await payments.listPaymentsForMember(tripP, party)).find((p) => p.id === pid("receipt"));
        expect(item).toMatchObject({ mine: true, hasReceipt: true });
        expect(await payments.getReceiptForParty(tripP, pid("receipt"), party)).toBe("receipts/r.jpg");
        expect(await payments.getPaymentForParty(tripP, pid("receipt"), party)).toMatchObject({ id: pid("receipt"), hasReceipt: true, recordedBy: "Ada", recordedByYou: party === MEMBER });
      }
      // A third member sees the payment line but never the receipt.
      const third = (await payments.listPaymentsForMember(tripP, THIRD)).find((p) => p.id === pid("receipt"));
      expect(third).toMatchObject({ mine: false, hasReceipt: false, amount: 300 });
      expect(JSON.stringify(await payments.listPaymentsForMember(tripP, THIRD))).not.toContain("receipts/r.jpg");
      expect(await payments.getReceiptForParty(tripP, pid("receipt"), THIRD)).toBeNull();
      expect(await payments.getPaymentForParty(tripP, pid("receipt"), THIRD)).toBeNull();
      // A stranger gets nothing at all.
      expect(await payments.listPaymentsForMember(tripP, STRANGER)).toEqual([]);
      expect(await payments.getReceiptForParty(tripP, pid("receipt"), STRANGER)).toBeNull();
      // Names are first names, guests included, and the viewer is marked.
      const mine = (await payments.listPaymentsForMember(tripP, OWNER)).find((p) => p.id === pid("to-guest"))!;
      expect(mine.from).toMatchObject({ name: "Maya", isYou: true, isGuest: false });
      expect(mine.to).toMatchObject({ name: "Dana", isGuest: true, isYou: false });
    });

    it("hides the receipt from a party who left, and shows it again after rejoining", async () => {
      expect(await trips.leaveTrip(tripP, MEMBER)).toBe("ok");
      expect(await payments.getReceiptForParty(tripP, pid("receipt"), MEMBER)).toBeNull();
      expect(await payments.getPaymentForParty(tripP, pid("receipt"), MEMBER)).toBeNull();
      expect(await payments.listPaymentsForMember(tripP, MEMBER)).toEqual([]);
      expect(await payments.deletePayment(tripP, pid("receipt"), MEMBER)).toBe("not-found");
      // The receiver still sees it, with the payer marked as left.
      const item = (await payments.listPaymentsForMember(tripP, OWNER)).find((p) => p.id === pid("receipt"))!;
      expect(item.from.hasLeft).toBe(true);
      await trips.joinTripByInviteCode(codeP, MEMBER);
      expect(await payments.getReceiptForParty(tripP, pid("receipt"), MEMBER)).toBe("receipts/r.jpg");
    });

    it("builds the Pay page only for a member, with the right rights and reasons", async () => {
      const page = await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, MEMBER);
      expect(page).toMatchObject({
        currency: "PHP",
        canRecord: true,
        from: { name: "Ada", isYou: true },
        to: { name: "Maya", isYou: false },
      });
      expect(page!.amount).toBe(30000 - 10000 - 5000 - 700 - 300);
      expect(JSON.stringify(page)).not.toContain("example.test");

      // A third member can look but not record; a stranger gets nothing.
      expect((await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, THIRD))!.canRecord).toBe(false);
      expect(await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, STRANGER)).toBeNull();
      // The same spot twice and a spot from nowhere give nothing.
      expect(await payments.getPayPageForMember(tripP, ownerSpot, ownerSpot, OWNER)).toBeNull();
      expect(await payments.getPayPageForMember(tripP, ownerSpot, `${ID_PREFIX}none`, OWNER)).toBeNull();

      // Receiver reasons: a guest, nobody saved details.
      await clearAccounts(OWNER);
      expect((await payments.getPayPageForMember(tripP, ownerSpot, dana, OWNER))!.receiver).toEqual({ reason: "guest" });
      expect((await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, MEMBER))!.receiver).toEqual({ reason: "none" });
      await payments.createPaymentAccount(OWNER, wallet, "qr/p.jpg");
      const withDetails = await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, MEMBER);
      expect(withDetails!.receiver).toMatchObject({ accounts: [{ number: "09171234567", hasQr: true }] });
      expect(JSON.stringify(withDetails)).not.toContain("qr/p.jpg");

      // A receiver who has left shows a reason, not their details.
      expect(await trips.leaveTrip(tripP, THIRD)).toBe("ok");
      expect((await payments.getPayPageForMember(tripP, memberSpot, thirdSpot, MEMBER))!.receiver).toEqual({ reason: "left" });
      await trips.joinTripByInviteCode(codeP, THIRD);
      await clearAccounts(OWNER);
    }, 30000);

    it("lets only a party delete a payment, and balances return to what they were", async () => {
      const first = await netOf(OWNER);
      expect(await record("delete-me", MEMBER, memberSpot, ownerSpot, 4000, { receiptPath: "receipts/d.jpg" })).toBe("ok");
      const after = await netOf(OWNER);
      expect(after[ownerSpot]).toBe(first[ownerSpot]! - 4000);
      expect(await payments.deletePayment(tripP, pid("delete-me"), THIRD)).toBe("not-found");
      expect(await payments.deletePayment(tripP, pid("delete-me"), STRANGER)).toBe("not-found");
      expect(await netOf(OWNER)).toEqual(after);
      expect(await payments.deletePayment(tripP, pid("delete-me"), OWNER)).toEqual({ receiptPath: "receipts/d.jpg" });
      expect(await payments.deletePayment(tripP, pid("delete-me"), OWNER)).toBe("not-found");
      expect(await netOf(OWNER)).toEqual(first);
    });

    // ---- QA: visibility edge cases ----

    const spotOf = async (tripId: string, name: string) =>
      (await trips.listTripMembers(tripId, OWNER)).find((p) => p.name === name)!.spotId;

    it("shuts a removed party out of the payment, receipt, Pay page and recording, until they rejoin", async () => {
      expect(await record("removed", MEMBER, memberSpot, ownerSpot, 200, { receiptPath: "receipts/removed.jpg" })).toBe("ok");
      expect(await trips.removeMember(tripP, memberSpot, OWNER)).toBe(true);

      expect(await payments.getReceiptForParty(tripP, pid("removed"), MEMBER)).toBeNull();
      expect(await payments.getPaymentForParty(tripP, pid("removed"), MEMBER)).toBeNull();
      expect(await payments.listPaymentsForMember(tripP, MEMBER)).toEqual([]);
      expect(await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, MEMBER)).toBeNull();
      expect(await record("removed-new", MEMBER, memberSpot, ownerSpot, 100)).toBe("not-allowed");
      expect(await payments.deletePayment(tripP, pid("removed"), MEMBER)).toBe("not-found");
      // The receiver keeps it.
      expect(await payments.getReceiptForParty(tripP, pid("removed"), OWNER)).toBe("receipts/removed.jpg");

      await trips.joinTripByInviteCode(codeP, MEMBER);
      expect(await payments.getReceiptForParty(tripP, pid("removed"), MEMBER)).toBe("receipts/removed.jpg");
      expect(await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, MEMBER)).not.toBeNull();
    }, 30000);

    it("gives a third member who left no Pay page and no payment list", async () => {
      expect(await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, THIRD)).not.toBeNull();
      expect(await trips.leaveTrip(tripP, THIRD)).toBe("ok");
      expect(await payments.getPayPageForMember(tripP, memberSpot, ownerSpot, THIRD)).toBeNull();
      expect(await payments.listPaymentsForMember(tripP, THIRD)).toEqual([]);
      await trips.joinTripByInviteCode(codeP, THIRD);
    });

    it("never lets a payment be reached through another trip's id", async () => {
      // MEMBER is a party to the payment and also a member of trip A, but the payment is in trip P.
      expect(await payments.getReceiptForParty(tripA, pid("removed"), MEMBER)).toBeNull();
      expect(await payments.getPaymentForParty(tripA, pid("removed"), MEMBER)).toBeNull();
      expect(await payments.deletePayment(tripA, pid("removed"), MEMBER)).toBe("not-found");
      expect((await payments.listPaymentsForMember(tripA, MEMBER)).some((p) => p.id === pid("removed"))).toBe(false);
      // Trip P's spots under trip A's id: no Pay page and nothing saved.
      expect(await payments.getPayPageForMember(tripA, memberSpot, ownerSpot, MEMBER)).toBeNull();
      expect(
        await payments.recordPayment({
          tripId: tripA,
          paymentId: pid("cross-trip"),
          fromSpot: memberSpot,
          toSpot: ownerSpot,
          amount: 100,
          method: "cash",
          receiptPath: null,
          userId: MEMBER,
        }),
      ).toBe("not-allowed");
      expect((await paymentRows()).some((r) => r.id === pid("cross-trip"))).toBe(false);
      // The payment is untouched.
      expect(await payments.getReceiptForParty(tripP, pid("removed"), MEMBER)).toBe("receipts/removed.jpg");
    });

    it("hides a person's details when the owner of the details leaves every shared trip", async () => {
      await clearAccounts(MEMBER);
      await payments.createPaymentAccount(MEMBER, bank, "qr/member.jpg");
      const [account] = await payments.listMyPaymentAccounts(MEMBER);
      // THIRD shares trips A and P with MEMBER.
      expect(await payments.listPaymentAccountsForViewer(MEMBER, THIRD)).toEqual([account]);
      expect(await trips.leaveTrip(tripA, MEMBER)).toBe("ok");
      expect(await payments.listPaymentAccountsForViewer(MEMBER, THIRD)).toEqual([account]); // trip P
      expect(await trips.leaveTrip(tripP, MEMBER)).toBe("ok");
      expect(await payments.listPaymentAccountsForViewer(MEMBER, THIRD)).toEqual([]);
      expect(await payments.getQrForViewer(account!.id, THIRD)).toBeNull();
      // OWNER still shares trip B with MEMBER; MEMBER still sees their own.
      expect(await payments.listPaymentAccountsForViewer(MEMBER, OWNER)).toEqual([account]);
      expect(await payments.getQrForViewer(account!.id, MEMBER)).toBe("qr/member.jpg");
      await trips.joinTripByInviteCode(codeA, MEMBER);
      await trips.joinTripByInviteCode(codeP, MEMBER);
      expect(await payments.listPaymentAccountsForViewer(MEMBER, THIRD)).toEqual([account]);
      await clearAccounts(MEMBER);
    }, 30000);

    describe("image routes against the real privacy rules", () => {
      let qrRoute: typeof import("@/app/profile/payment-details/[accountId]/qr/route");
      let receiptRoute: typeof import("@/app/trips/[tripId]/costs/payments/[paymentId]/receipt/route");
      let accountId: string;

      const getQr = async (as: string, id = accountId) => {
        signedIn = as;
        return qrRoute.GET(new Request("http://localhost/qr"), { params: Promise.resolve({ accountId: id }) });
      };
      const getReceipt = async (as: string, tripId = tripP, paymentId = pid("route")) => {
        signedIn = as;
        return receiptRoute.GET(new Request("http://localhost/receipt"), {
          params: Promise.resolve({ tripId, paymentId }),
        });
      };
      const expectImage = (response: Response) => {
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/jpeg");
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      };
      const expectRefused = async (response: Response) => {
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("Not found");
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      };

      // Leaves, or is removed from, every trip they share with OWNER; returns a rejoin.
      async function shutOut(userId: string, name: string, how: "leave" | "remove") {
        const shared = [tripA, tripP];
        for (const tripId of shared) {
          if (how === "leave") expect(await trips.leaveTrip(tripId, userId)).toBe("ok");
          else expect(await trips.removeMember(tripId, await spotOf(tripId, name), OWNER)).toBe(true);
        }
        return async () => {
          await trips.joinTripByInviteCode(codeA, userId);
          await trips.joinTripByInviteCode(codeP, userId);
        };
      }

      beforeAll(async () => {
        qrRoute = await import("@/app/profile/payment-details/[accountId]/qr/route");
        receiptRoute = await import("@/app/trips/[tripId]/costs/payments/[paymentId]/receipt/route");
        await clearAccounts(OWNER);
        await payments.createPaymentAccount(OWNER, wallet, "qr/route.jpg");
        accountId = (await payments.listMyPaymentAccounts(OWNER))[0]!.id;
        expect(await record("route", MEMBER, memberSpot, ownerSpot, 100, { receiptPath: "receipts/route.jpg" })).toBe("ok");
      });

      afterAll(async () => {
        await clearAccounts(OWNER);
      });

      it("QR route: the owner and a member of a shared trip get the image, a stranger gets 404", async () => {
        readImage.mockClear();
        expectImage(await getQr(OWNER));
        expectImage(await getQr(THIRD));
        expect(readImage).toHaveBeenCalledWith("qr/route.jpg");
        readImage.mockClear();
        await expectRefused(await getQr(STRANGER));
        await expectRefused(await getQr(OTHER_OWNER));
        await expectRefused(await getQr(MEMBER, `${ID_PREFIX}missing`));
        expect(readImage).not.toHaveBeenCalled();
      });

      it("QR route: 404 right after leaving or being removed, the image again after rejoining", async () => {
        for (const how of ["leave", "remove"] as const) {
          const rejoin = await shutOut(THIRD, "Cho Test", how);
          await expectRefused(await getQr(THIRD));
          await rejoin();
          expectImage(await getQr(THIRD));
        }
      }, 60000);

      it("receipt route: payer and receiver get the image, a third member and a stranger get 404", async () => {
        readImage.mockClear();
        expectImage(await getReceipt(MEMBER));
        expectImage(await getReceipt(OWNER));
        expect(readImage).toHaveBeenCalledWith("receipts/route.jpg");
        readImage.mockClear();
        await expectRefused(await getReceipt(THIRD));
        await expectRefused(await getReceipt(STRANGER));
        // The payer, through a trip id they are in but the payment is not.
        await expectRefused(await getReceipt(MEMBER, tripA));
        expect(readImage).not.toHaveBeenCalled();
      });

      it("receipt route: 404 for the payer right after leaving or being removed, the image again after rejoining", async () => {
        for (const how of ["leave", "remove"] as const) {
          const rejoin = await shutOut(MEMBER, "Ada Test", how);
          await expectRefused(await getReceipt(MEMBER));
          expectImage(await getReceipt(OWNER));
          await rejoin();
          expectImage(await getReceipt(MEMBER));
        }
      }, 60000);
    });
  });

  describe("guests and trip deletion", () => {
    it("blocks removing a guest who is in a payment, and allows one who is in neither", async () => {
      const tripG = await trips.createTrip(OWNER, { ...tripInput, name: "Guests trip" });
      await trips.addGuest(tripG, OWNER, "Gus");
      await trips.addGuest(tripG, OWNER, "Gwen");
      const people = await trips.listTripMembers(tripG, OWNER);
      const spotNamed = (name: string) => people.find((p) => p.name === name)!.spotId;
      const owner = spotNamed("Maya Test");
      const gus = spotNamed("Gus");
      const gwen = spotNamed("Gwen");

      expect(
        await payments.recordPayment({
          tripId: tripG,
          paymentId: `${ID_PREFIX}p-gus-${RUN}`,
          fromSpot: gus,
          toSpot: owner,
          amount: 500,
          method: "cash",
          receiptPath: null,
          userId: OWNER,
        }),
      ).toBe("ok");

      expect(await trips.getGuestForEditor(tripG, gus, OWNER)).toMatchObject({ costCount: 0, paymentCount: 1 });
      expect(await trips.getGuestForEditor(tripG, gwen, OWNER)).toMatchObject({ costCount: 0, paymentCount: 0 });
      expect(await trips.removeGuest(tripG, gus, OWNER)).toBe("in-costs");
      expect(await trips.getGuestForEditor(tripG, gus, OWNER)).not.toBeNull();
      expect(await trips.removeGuest(tripG, gwen, OWNER)).toBe("ok");
      expect(await trips.getGuestForEditor(tripG, gwen, OWNER)).toBeNull();

      // Once the payment is deleted the guest can go.
      expect(await payments.deletePayment(tripG, `${ID_PREFIX}p-gus-${RUN}`, OWNER)).toEqual({ receiptPath: null });
      expect(await trips.removeGuest(tripG, gus, OWNER)).toBe("ok");
    }, 30000);

    it("deletes a trip that has payments, with and without receipts, and the receipt files after", async () => {
      const costs = await import("./costs");
      const money = await import("./money");
      const tripD = await trips.createTrip(OWNER, { ...tripInput, name: "Delete trip" });
      const code = (await trips.getInviteCodeForMember(tripD, OWNER))!;
      await trips.joinTripByInviteCode(code, MEMBER);
      const people = await trips.listTripMembers(tripD, OWNER);
      const owner = people.find((p) => p.name === "Maya Test")!.spotId;
      const member = people.find((p) => p.name === "Ada Test")!.spotId;
      const shares = money.splitEqually(10000, [owner, member], owner).map((share) => ({ ...share, originalAmount: null }));
      await costs.createCost(tripD, OWNER, `${ID_PREFIX}c-del-${RUN}`, {
        description: "Taxi",
        amount: 10000,
        paidBy: owner,
        category: null,
        spentOn: "2027-03-12",
        shares,
        money: { kind: "trip" as const },
      });
      const pay = (id: string, receiptPath: string | null) =>
        payments.recordPayment({
          tripId: tripD,
          paymentId: `${ID_PREFIX}p-${id}-${RUN}`,
          fromSpot: member,
          toSpot: owner,
          amount: 1000,
          method: "gcash",
          receiptPath,
          userId: MEMBER,
        });
      expect(await pay("del-a", "receipts/del-a.jpg")).toBe("ok");
      expect(await pay("del-b", null)).toBe("ok");

      // A member is not the owner: nothing is deleted, no file is touched.
      deleteImages.mockClear();
      expect(await trips.deleteTripForOwner(tripD, MEMBER)).toBe(false);
      expect(await trips.deleteTripForOwner(tripD, STRANGER)).toBe(false);
      expect(deleteImages).not.toHaveBeenCalled();
      expect(await dbModule.db.select().from(schema.payment).where(orm.eq(schema.payment.tripId, tripD))).toHaveLength(2);

      expect(await trips.deleteTripForOwner(tripD, OWNER)).toBe(true);
      expect(await dbModule.db.select().from(schema.payment).where(orm.eq(schema.payment.tripId, tripD))).toEqual([]);
      expect(await dbModule.db.select().from(schema.cost).where(orm.eq(schema.cost.tripId, tripD))).toEqual([]);
      expect(await dbModule.db.select().from(schema.trip).where(orm.eq(schema.trip.id, tripD))).toEqual([]);
      expect(deleteImages).toHaveBeenCalledTimes(1);
      expect(deleteImages).toHaveBeenCalledWith(["receipts/del-a.jpg"]);
      // Repeating it is harmless and deletes no files.
      expect(await trips.deleteTripForOwner(tripD, OWNER)).toBe(false);
      expect(deleteImages).toHaveBeenCalledTimes(1);
    }, 30000);
  });
});
