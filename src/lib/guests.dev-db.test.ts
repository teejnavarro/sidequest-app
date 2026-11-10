import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the guest part of the privacy layer against the real dev database, with made-up
// people and trips that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as trips.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every user and trip this test adds has an id starting with ID_PREFIX, and cleanup removes
//   only those rows (guests go with their trip), including any left by an earlier run that
//   crashed. The prefix differs from the other dev-db tests, so files don't touch each other.

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-guest-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const ADDER = `${ID_PREFIX}adder-${RUN}`; // a member who adds guests
const OTHER = `${ID_PREFIX}other-${RUN}`; // a member who did not add them
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const JOINER = `${ID_PREFIX}joiner-${RUN}`;
const JOINER_TWO = `${ID_PREFIX}joiner-two-${RUN}`;
const OWNER_TWO = `${ID_PREFIX}owner-two-${RUN}`;

const input = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
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

describe("guests on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripId: string;
  let code: string;

  async function spots(forTrip: string) {
    return dbModule.db
      .select()
      .from(schema.tripMember)
      .where(orm.eq(schema.tripMember.tripId, forTrip))
      .orderBy(orm.asc(schema.tripMember.joinedAt), orm.asc(schema.tripMember.id));
  }

  async function guestSpotId(forTrip: string, name: string) {
    const rows = await spots(forTrip);
    return rows.find((row) => row.guestName === name)?.id;
  }

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    // Deleting a trip also deletes its spots, guests included.
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
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    const people = [OWNER, ADDER, OTHER, STRANGER, JOINER, JOINER_TWO, OWNER_TWO];
    await dbModule.db.insert(schema.user).values(
      people.map((id, index) => ({
        id,
        name: ["Maya Test", "Ada Test", "Ori Test", "Lia Test", "Ana Test", "Cho Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripId = await trips.createTrip(OWNER, input);
    code = (await trips.getInviteCodeForMember(tripId, OWNER))!;
    await trips.joinTripByInviteCode(code, ADDER);
    await trips.joinTripByInviteCode(code, OTHER);
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(
      await db.select().from(schema.tripMember).where(like(schema.tripMember.addedBy, `${ID_PREFIX}%`)),
    ).toEqual([]);
  });

  it("gave every member row an id, and the made-up members still list", async () => {
    const rows = await spots(tripId);
    expect(rows.map((row) => row.userId)).toEqual([OWNER, ADDER, OTHER]);
    for (const row of rows) expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it("lets a member add a guest, and a stranger or a made-up trip add nothing", async () => {
    await expect(trips.addGuest(tripId, ADDER, "Dana")).resolves.toBe("ok");
    await expect(trips.addGuest(tripId, STRANGER, "Sneaky")).resolves.toBe("not-found");
    await expect(trips.addGuest(`${ID_PREFIX}no-such-trip`, ADDER, "Ghost")).resolves.toBe("not-found");
    const names = (await spots(tripId)).map((row) => row.guestName);
    expect(names).toEqual([null, null, null, "Dana"]);
  });

  it("refuses a second guest with the same name in any capitals, but allows it in another trip", async () => {
    await expect(trips.addGuest(tripId, ADDER, "dana")).resolves.toBe("duplicate");
    await expect(trips.addGuest(tripId, OTHER, "DANA")).resolves.toBe("duplicate");
    expect((await spots(tripId)).filter((row) => row.guestName)).toHaveLength(1);

    const second = await trips.createTrip(OWNER_TWO, input);
    await expect(trips.addGuest(second, OWNER_TWO, "Dana")).resolves.toBe("ok");
  });

  it("lists guests with a Guest flag, who added them and no email", async () => {
    await trips.addGuest(tripId, OTHER, "Eli");
    const list = await trips.listTripMembers(tripId, ADDER);
    expect(list.map((row) => row.name)).toEqual(["Maya Test", "Ada Test", "Ori Test", "Dana", "Eli"]);
    expect(list.map((row) => row.isGuest)).toEqual([false, false, false, true, true]);
    const dana = list[3];
    expect(dana).toMatchObject({ addedById: ADDER, addedByName: "Ada Test", image: null });
    expect(dana.id).toBe(dana.spotId); // a guest's id is its spot id
    expect(list[1].id).toBe(ADDER); // a person's id stays the user id
    expect(JSON.stringify(list)).not.toContain("@example.test");
    await expect(trips.listTripMembers(tripId, STRANGER)).resolves.toEqual([]);

    const mine = await trips.listMyTrips(ADDER);
    expect(mine.find((row) => row.id === tripId)?.members).toHaveLength(5);
    expect(await trips.getTripByInviteCode(code)).toMatchObject({
      members: expect.arrayContaining([expect.objectContaining({ name: "Dana", isGuest: true })]),
    });
  });

  it("does not count a guest as a member of anything", async () => {
    const dana = (await guestSpotId(tripId, "Dana"))!;
    await expect(trips.isTripMember(tripId, dana)).resolves.toBe(false);
    await expect(trips.getTripForMember(tripId, dana)).resolves.toBeNull();
  });

  it("lets the adder and the owner open a guest, and nobody else", async () => {
    const dana = (await guestSpotId(tripId, "Dana"))!;
    await expect(trips.getGuestForEditor(tripId, dana, ADDER)).resolves.toEqual({
      spotId: dana,
      name: "Dana",
      addedById: ADDER,
      addedByName: "Ada Test",
    });
    await expect(trips.getGuestForEditor(tripId, dana, OWNER)).resolves.toMatchObject({ spotId: dana });
    await expect(trips.getGuestForEditor(tripId, dana, OTHER)).resolves.toBeNull();
    await expect(trips.getGuestForEditor(tripId, dana, STRANGER)).resolves.toBeNull();
    await expect(trips.getGuestForEditor(tripId, `${ID_PREFIX}no-such-spot`, ADDER)).resolves.toBeNull();
    // A real spot id used with another trip finds nothing.
    const second = await trips.createTrip(OWNER_TWO, input);
    await expect(trips.getGuestForEditor(second, dana, OWNER_TWO)).resolves.toBeNull();
    // A signed-in person's spot is not a guest.
    const owner = (await spots(tripId)).find((row) => row.userId === OWNER)!;
    await expect(trips.getGuestForEditor(tripId, owner.id, OWNER)).resolves.toBeNull();
  });

  it("lets the adder and the owner rename a guest, and nobody else", async () => {
    const eli = (await guestSpotId(tripId, "Eli"))!; // added by OTHER
    await expect(trips.renameGuest(tripId, eli, ADDER, "Elijah")).resolves.toBe("not-found");
    await expect(trips.renameGuest(tripId, eli, STRANGER, "Elijah")).resolves.toBe("not-found");
    expect(await guestSpotId(tripId, "Elijah")).toBeUndefined();

    await expect(trips.renameGuest(tripId, eli, OTHER, "Eli J")).resolves.toBe("ok");
    await expect(trips.renameGuest(tripId, eli, OWNER, "Elijah")).resolves.toBe("ok");
    expect(await guestSpotId(tripId, "Elijah")).toBe(eli);
    // Same name, other capitals, on the same guest is fine.
    await expect(trips.renameGuest(tripId, eli, OWNER, "ELIJAH")).resolves.toBe("ok");
    // Taking another guest's name, in any capitals, is refused and changes nothing.
    await expect(trips.renameGuest(tripId, eli, OWNER, "dana")).resolves.toBe("duplicate");
    expect(await guestSpotId(tripId, "ELIJAH")).toBe(eli);
  });

  it("lets the adder and the owner remove a guest, and nobody else", async () => {
    await trips.addGuest(tripId, ADDER, "Temp One");
    await trips.addGuest(tripId, ADDER, "Temp Two");
    const one = (await guestSpotId(tripId, "Temp One"))!;
    const two = (await guestSpotId(tripId, "Temp Two"))!;
    await expect(trips.removeGuest(tripId, one, OTHER)).resolves.toBe(false);
    await expect(trips.removeGuest(tripId, one, STRANGER)).resolves.toBe(false);
    await expect(trips.removeGuest(tripId, `${ID_PREFIX}no-such-spot`, OWNER)).resolves.toBe(false);
    expect(await guestSpotId(tripId, "Temp One")).toBe(one);

    await expect(trips.removeGuest(tripId, one, ADDER)).resolves.toBe(true);
    await expect(trips.removeGuest(tripId, two, OWNER)).resolves.toBe(true);
    await expect(trips.removeGuest(tripId, one, ADDER)).resolves.toBe(false); // harmless twice
    expect(await guestSpotId(tripId, "Temp One")).toBeUndefined();
    expect(await guestSpotId(tripId, "Temp Two")).toBeUndefined();
  });

  it("never removes a signed-in member as if they were a guest", async () => {
    const owner = (await spots(tripId)).find((row) => row.userId === OWNER)!;
    await expect(trips.removeGuest(tripId, owner.id, OWNER)).resolves.toBe(false);
    await expect(trips.renameGuest(tripId, owner.id, OWNER, "Nope")).resolves.toBe("not-found");
    await expect(trips.getTripForMember(tripId, OWNER)).resolves.toMatchObject({ id: tripId });
  });

  it("lists unclaimed guests by the invite code, names and spot ids only", async () => {
    const found = await trips.listUnclaimedGuestsByInviteCode(code);
    expect(found.map((row) => row.name).sort()).toEqual(["Dana", "ELIJAH"]);
    expect(Object.keys(found[0]).sort()).toEqual(["id", "name"]);
    await expect(trips.listUnclaimedGuestsByInviteCode(crypto.randomUUID())).resolves.toEqual([]);
    await expect(trips.listUnclaimedGuestsByInviteCode("not-a-code")).resolves.toEqual([]);
  });

  describe("claiming a spot", () => {
    it("fills in the account on the same row, keeping its id and place in the list", async () => {
      const before = await spots(tripId);
      const dana = before.find((row) => row.guestName === "Dana")!;
      const place = before.findIndex((row) => row.id === dana.id);

      await expect(trips.joinTripByInviteCode(code, JOINER, dana.id)).resolves.toEqual({ tripId });

      const after = await spots(tripId);
      expect(after).toHaveLength(before.length);
      expect(after.findIndex((row) => row.id === dana.id)).toBe(place);
      const claimed = after[place];
      expect(claimed).toMatchObject({ id: dana.id, userId: JOINER, guestName: null, addedBy: null });
      expect(claimed.joinedAt).toEqual(dana.joinedAt);

      await expect(trips.isTripMember(tripId, JOINER)).resolves.toBe(true);
      const list = await trips.listTripMembers(tripId, JOINER);
      const mine = list.find((row) => row.spotId === dana.id)!;
      expect(mine).toMatchObject({ id: JOINER, name: "Ana Test", isGuest: false, addedById: null });
      expect(list.map((row) => row.name)).not.toContain("Dana");
    });

    it("can't be done twice, or on a spot that was taken", async () => {
      const taken = (await spots(tripId)).find((row) => row.userId === JOINER)!;
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO, taken.id)).resolves.toBe("taken");
      await expect(trips.isTripMember(tripId, JOINER_TWO)).resolves.toBe(false);
      expect((await spots(tripId)).find((row) => row.id === taken.id)?.userId).toBe(JOINER);
    });

    it("says taken for a removed or made-up spot and adds nobody", async () => {
      const before = (await spots(tripId)).length;
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO, `${ID_PREFIX}no-such-spot`)).resolves.toBe("taken");
      expect(await spots(tripId)).toHaveLength(before);
      await expect(trips.isTripMember(tripId, JOINER_TWO)).resolves.toBe(false);
    });

    it("changes nothing for a person who is already in the trip", async () => {
      const elijah = (await guestSpotId(tripId, "ELIJAH"))!;
      // OTHER is already a member: the guest stays a guest, and they still count as joined.
      await expect(trips.joinTripByInviteCode(code, OTHER, elijah)).resolves.toEqual({ tripId });
      expect(await guestSpotId(tripId, "ELIJAH")).toBe(elijah);
      expect((await spots(tripId)).filter((row) => row.userId === OTHER)).toHaveLength(1);
    });

    it("can't claim a spot in another trip with this trip's code", async () => {
      const second = await trips.createTrip(OWNER_TWO, input);
      await trips.addGuest(second, OWNER_TWO, "Far Away");
      const far = (await guestSpotId(second, "Far Away"))!;
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO, far)).resolves.toBe("taken");
      expect((await spots(second)).find((row) => row.id === far)?.userId).toBeNull();
    });

    it("can't claim a signed-in person's spot", async () => {
      const owner = (await spots(tripId)).find((row) => row.userId === OWNER)!;
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO, owner.id)).resolves.toBe("taken");
      expect((await spots(tripId)).find((row) => row.id === owner.id)?.userId).toBe(OWNER);
    });

    it("gives a new person a plain new spot when they pick no guest", async () => {
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO)).resolves.toEqual({ tripId });
      await expect(trips.joinTripByInviteCode(code, JOINER_TWO)).resolves.toEqual({ tripId });
      expect((await spots(tripId)).filter((row) => row.userId === JOINER_TWO)).toHaveLength(1);
    });

    it("refuses a claimed spot for rename and remove as a guest", async () => {
      const claimed = (await spots(tripId)).find((row) => row.userId === JOINER)!;
      await expect(trips.getGuestForEditor(tripId, claimed.id, ADDER)).resolves.toBeNull();
      await expect(trips.renameGuest(tripId, claimed.id, ADDER, "Dana")).resolves.toBe("not-found");
      await expect(trips.removeGuest(tripId, claimed.id, ADDER)).resolves.toBe(false);
      await expect(trips.removeGuest(tripId, claimed.id, OWNER)).resolves.toBe(false);
      expect((await spots(tripId)).find((row) => row.id === claimed.id)?.userId).toBe(JOINER);
    });
  });

  it("removes guests when the trip is deleted", async () => {
    const doomed = await trips.createTrip(OWNER, input);
    await trips.addGuest(doomed, OWNER, "Goes With Trip");
    expect(await spots(doomed)).toHaveLength(2);
    await expect(trips.deleteTripForOwner(doomed, OWNER)).resolves.toBe(true);
    expect(await spots(doomed)).toEqual([]);
  });

  it("keeps the database rules even if code is bypassed", async () => {
    const { db } = dbModule;
    // A spot must be either a person or a guest.
    await expect(
      db.insert(schema.tripMember).values({ tripId, userId: STRANGER, guestName: "Both" }),
    ).rejects.toThrow();
    await expect(db.insert(schema.tripMember).values({ tripId })).rejects.toThrow();
    expect((await spots(tripId)).some((row) => row.userId === STRANGER)).toBe(false);
  });
});
