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
vi.mock("./blob-store", () => ({ deleteImages }));

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
});
