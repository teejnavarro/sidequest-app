import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the privacy layer against the real dev database, with made-up people and trips
// that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules:
// - The address comes from .env.development.local and nowhere else. No fallback: if
//   that file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every row this test adds has an id starting with ID_PREFIX, and cleanup removes
//   those rows, including any left by an earlier run that crashed.

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-db-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const MEMBER = `${ID_PREFIX}member-${RUN}`;
const STRANGER = `${ID_PREFIX}stranger-${RUN}`;
const OWNER_TWO = `${ID_PREFIX}owner-two-${RUN}`;
const JOINER = `${ID_PREFIX}joiner-${RUN}`;
const OUTSIDER = `${ID_PREFIX}outsider-${RUN}`;

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

describe("privacy layer on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripId: string;

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    // Deleting a trip also deletes its member rows.
    await db.delete(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`));
    await db.delete(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`));
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

    await dbModule.db.insert(schema.user).values(
      [OWNER, MEMBER, STRANGER, OWNER_TWO, JOINER, OUTSIDER].map((id, index) => ({
        id,
        name: ["Maya Test", "Ben Test", "Lia Test", "Rey Test", "Ana Test", "Cho Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripId = await trips.createTrip(OWNER, input);
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(
      await db.select().from(schema.tripMember).where(like(schema.tripMember.userId, `${ID_PREFIX}%`)),
    ).toEqual([]);
  });

  it("saves the trip and the owner's member row, keeping the accents and dates exact", async () => {
    const found = await trips.getTripForMember(tripId, OWNER);
    expect(found).toMatchObject({ ...input, id: tripId, ownerId: OWNER, ownerName: "Maya Test" });
    const members = await dbModule.db
      .select()
      .from(schema.tripMember)
      .where(orm.eq(schema.tripMember.tripId, tripId));
    expect(members.map((row) => row.userId)).toEqual([OWNER]);
  });

  it("never returns an email", async () => {
    const found = await trips.getTripForMember(tripId, OWNER);
    const listed = await trips.listMyTrips(OWNER);
    expect(JSON.stringify([found, listed])).not.toContain("@example.test");
  });

  it("keeps a stranger out: can't see, list or change the trip", async () => {
    await expect(trips.getTripForMember(tripId, STRANGER)).resolves.toBeNull();
    await expect(trips.listMyTrips(STRANGER)).resolves.toEqual([]);
    await expect(
      trips.updateTripForMember(tripId, STRANGER, { ...input, name: "Changed by a stranger" }),
    ).resolves.toBe(false);
    await expect(trips.getTripForMember(tripId, OWNER)).resolves.toMatchObject({
      name: input.name,
    });
  });

  it("gives a made-up trip id the same answer as a stranger", async () => {
    await expect(trips.getTripForMember(`${ID_PREFIX}no-such-trip`, OWNER)).resolves.toBeNull();
    await expect(
      trips.updateTripForMember(`${ID_PREFIX}no-such-trip`, OWNER, input),
    ).resolves.toBe(false);
  });

  it("lets a second member see and edit the trip, and the owner stays the owner", async () => {
    await dbModule.db.insert(schema.tripMember).values({ tripId, userId: MEMBER });

    await expect(trips.getTripForMember(tripId, MEMBER)).resolves.toMatchObject({ id: tripId });
    expect((await trips.listMyTrips(MEMBER)).map((row) => row.id)).toEqual([tripId]);

    const edited = {
      name: "Đà Nẵng instead",
      startDate: "2027-04-01",
      endDate: "2027-04-01",
      timeZone: "Asia/Manila",
      currency: "PHP",
      destination: null,
    };
    await expect(trips.updateTripForMember(tripId, MEMBER, edited)).resolves.toBe(true);

    const seenByOwner = await trips.getTripForMember(tripId, OWNER);
    expect(seenByOwner).toMatchObject({ ...edited, ownerId: OWNER, ownerName: "Maya Test" });
    await expect(trips.getTripForMember(tripId, STRANGER)).resolves.toBeNull();
  });

  it("lists the person's trips newest first", async () => {
    const newer = await trips.createTrip(OWNER, { ...input, name: "Newer trip" });
    const newest = await trips.createTrip(OWNER, { ...input, name: "Newest trip" });
    const listed = await trips.listMyTrips(OWNER);
    expect(listed.map((row) => row.id)).toEqual([newest, newer, tripId]);
  });

  it("saves nothing at all when the second row in a batch fails", async () => {
    const { db } = dbModule;
    const id = `${ID_PREFIX}batch-${RUN}`;
    await expect(
      db.batch([
        db.insert(schema.trip).values({ ...input, id, ownerId: OWNER }),
        db.insert(schema.tripMember).values({ tripId: id, userId: `${ID_PREFIX}no-such-person` }),
      ]),
    ).rejects.toThrow();
    const rows = await db.select().from(schema.trip).where(orm.eq(schema.trip.id, id));
    expect(rows).toEqual([]);
  });

  describe("invite codes", () => {
    let tripA: string;
    let tripB: string;
    let codeA: string;
    let codeB: string;

    async function rowsFor(userId: string, forTrip: string) {
      return dbModule.db
        .select()
        .from(schema.tripMember)
        .where(orm.and(orm.eq(schema.tripMember.userId, userId), orm.eq(schema.tripMember.tripId, forTrip)));
    }

    beforeAll(async () => {
      tripA = await trips.createTrip(OWNER, { ...input, name: "Group A trip" });
      tripB = await trips.createTrip(OWNER_TWO, { ...input, name: "Group B trip" });
      codeA = (await trips.getInviteCodeForMember(tripA, OWNER))!;
      codeB = (await trips.getInviteCodeForMember(tripB, OWNER_TWO))!;
    });

    it("gives every trip its own code, and the database filled in the new ones", async () => {
      expect(codeA).toMatch(/^[0-9a-f-]{36}$/);
      expect(codeB).toMatch(/^[0-9a-f-]{36}$/);
      expect(codeA).not.toBe(codeB);
      // Every trip in the dev database (made-up and older ones) has a distinct code.
      const codes = (await dbModule.db.select({ code: schema.trip.inviteCode }).from(schema.trip)).map(
        (row) => row.code,
      );
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("shows the owner the code and the members, never an email", async () => {
      await expect(trips.getInviteCodeForMember(tripA, OWNER)).resolves.toBe(codeA);
      const members = await trips.listTripMembers(tripA, OWNER);
      expect(members.map((row) => row.id)).toEqual([OWNER]);
      expect(members[0]).toEqual({
        id: OWNER,
        spotId: expect.any(String),
        name: "Maya Test",
        image: null,
        isGuest: false,
        addedById: null,
        addedByName: null,
        hasLeft: false,
      });
      expect(JSON.stringify(members)).not.toContain("@example.test");
    });

    it("lets a stranger see no code, no members and no trip", async () => {
      await expect(trips.getInviteCodeForMember(tripA, STRANGER)).resolves.toBeNull();
      await expect(trips.listTripMembers(tripA, STRANGER)).resolves.toEqual([]);
      await expect(trips.getTripForMember(tripA, STRANGER)).resolves.toBeNull();
      await expect(trips.isTripMember(tripA, STRANGER)).resolves.toBe(false);
    });

    it("shows a visitor with the code the trip details and who is going, never email", async () => {
      const seen = await trips.getTripByInviteCode(codeA);
      expect(seen).toEqual({
        id: tripA,
        name: "Group A trip",
        startDate: input.startDate,
        endDate: input.endDate,
        destination: null,
        ownerName: "Maya Test",
        members: [
          {
            id: OWNER,
            spotId: expect.any(String),
            name: "Maya Test",
            image: null,
            isGuest: false,
            addedById: null,
            addedByName: null,
            hasLeft: false,
          },
        ],
      });
      expect(JSON.stringify(seen)).not.toContain("@example.test");
      await expect(trips.getTripByInviteCode(crypto.randomUUID())).resolves.toBeNull();
    });

    it("adds exactly one row when someone joins, and joining twice is harmless", async () => {
      await expect(trips.joinTripByInviteCode(codeA, JOINER)).resolves.toEqual({ tripId: tripA });
      expect(await rowsFor(JOINER, tripA)).toHaveLength(1);
      await expect(trips.joinTripByInviteCode(codeA.toUpperCase(), JOINER)).resolves.toEqual({
        tripId: tripA,
      });
      expect(await rowsFor(JOINER, tripA)).toHaveLength(1);
      await expect(trips.isTripMember(tripA, JOINER)).resolves.toBe(true);
      expect((await trips.listTripMembers(tripA, JOINER)).map((row) => row.id)).toEqual([OWNER, JOINER]);
    });

    it("joins nobody with a made-up or wrong-shaped code", async () => {
      await expect(trips.joinTripByInviteCode(crypto.randomUUID(), OUTSIDER)).resolves.toBeNull();
      await expect(trips.joinTripByInviteCode("not-a-code", OUTSIDER)).resolves.toBeNull();
      await expect(trips.joinTripByInviteCode(tripA, OUTSIDER)).resolves.toBeNull(); // a trip id is not a code
      await expect(trips.listMyTrips(OUTSIDER)).resolves.toEqual([]);
    });

    it("keeps two trips with different groups fully separate", async () => {
      await trips.joinTripByInviteCode(codeB, OUTSIDER);

      // Group B's people see only trip B.
      expect((await trips.listMyTrips(OUTSIDER)).map((row) => row.id)).toEqual([tripB]);
      await expect(trips.getTripForMember(tripA, OUTSIDER)).resolves.toBeNull();
      await expect(trips.getInviteCodeForMember(tripA, OUTSIDER)).resolves.toBeNull();
      await expect(trips.listTripMembers(tripA, OUTSIDER)).resolves.toEqual([]);

      // Group A's people never see trip B or its people.
      await expect(trips.getTripForMember(tripB, JOINER)).resolves.toBeNull();
      await expect(trips.getInviteCodeForMember(tripB, OWNER)).resolves.toBeNull();
      await expect(trips.listTripMembers(tripB, OWNER)).resolves.toEqual([]);
      const groupA = (await trips.listTripMembers(tripA, OWNER)).map((row) => row.id);
      expect(groupA).toEqual([OWNER, JOINER]);
      const groupB = (await trips.listTripMembers(tripB, OWNER_TWO)).map((row) => row.id);
      expect(groupB).toEqual([OWNER_TWO, OUTSIDER]);

      // Group A's code opens nothing of trip B.
      expect(await rowsFor(OUTSIDER, tripA)).toHaveLength(0);
    });

    it("lists each trip's own people in My trips, and nobody else's", async () => {
      // JOINER is in trip A only; OUTSIDER is in trip B only.
      const joinerSees = await trips.listMyTrips(JOINER);
      expect(joinerSees.map((row) => row.id)).toEqual([tripA]);
      expect(joinerSees[0].members.map((m) => m.id)).toEqual([OWNER, JOINER]);

      const outsiderSees = await trips.listMyTrips(OUTSIDER);
      expect(outsiderSees.map((row) => row.id)).toEqual([tripB]);
      expect(outsiderSees[0].members.map((m) => m.id)).toEqual([OWNER_TWO, OUTSIDER]);

      // A person in both trips sees each trip with its own people.
      await dbModule.db.insert(schema.tripMember).values({ tripId: tripB, userId: MEMBER });
      await dbModule.db.insert(schema.tripMember).values({ tripId: tripA, userId: MEMBER });
      const both = await trips.listMyTrips(MEMBER);
      const byId = new Map(both.map((row) => [row.id, row.members.map((m) => m.id)]));
      expect(byId.get(tripA)).toEqual([OWNER, JOINER, MEMBER]);
      expect(byId.get(tripB)).toEqual([OWNER_TWO, OUTSIDER, MEMBER]);

      // Nobody gets email in the list.
      expect(JSON.stringify(both)).not.toContain("@example.test");
      expect(JSON.stringify(both)).not.toContain("inviteCode");
    });

    it("saves a destination, clears it on edit, and never leaks it to a stranger", async () => {
      const withPlace = await trips.createTrip(OWNER, { ...input, name: "Place trip", destination: "Hội An" });
      await expect(trips.getTripForMember(withPlace, OWNER)).resolves.toMatchObject({
        destination: "Hội An",
      });
      await expect(trips.getTripForMember(withPlace, STRANGER)).resolves.toBeNull();
      expect((await trips.listMyTrips(OWNER)).find((row) => row.id === withPlace)?.destination).toBe(
        "Hội An",
      );
      await expect(
        trips.updateTripForMember(withPlace, OWNER, { ...input, name: "Place trip", destination: null }),
      ).resolves.toBe(true);
      await expect(trips.getTripForMember(withPlace, OWNER)).resolves.toMatchObject({
        destination: null,
      });
    });

    it("shows a visitor with the code the destination and the people going, never email", async () => {
      const code = (await trips.getInviteCodeForMember(tripB, OWNER_TWO))!;
      const seen = await trips.getTripByInviteCode(code);
      expect(seen?.members.map((m) => m.id)).toEqual([OWNER_TWO, OUTSIDER, MEMBER]);
      expect(seen).toHaveProperty("destination");
      const text = JSON.stringify(seen);
      expect(text).not.toContain("@example.test");
      expect(text).not.toContain(code);
      // Trip A's people never appear in trip B's invite.
      expect(text).not.toContain(JOINER);
    });

    it("never puts the invite code in the list or detail results", async () => {
      const listed = await trips.listMyTrips(OWNER);
      const detail = await trips.getTripForMember(tripA, OWNER);
      const text = JSON.stringify([listed, detail]);
      expect(text).not.toContain(codeA);
      expect(text).not.toContain(codeB);
      expect(text).not.toContain("inviteCode");
    });
  });
  describe("deleting a trip", () => {
    // Only trips made here, by made-up people with the test prefix, are ever deleted.
    let doomed: string;
    let kept: string;
    let doomedCode: string;

    async function memberRows(forTrip: string) {
      return dbModule.db
        .select()
        .from(schema.tripMember)
        .where(orm.eq(schema.tripMember.tripId, forTrip));
    }

    beforeAll(async () => {
      doomed = await trips.createTrip(OWNER, { ...input, name: "Trip to delete" });
      kept = await trips.createTrip(OWNER, { ...input, name: "Trip to keep" });
      doomedCode = (await trips.getInviteCodeForMember(doomed, OWNER))!;
      await trips.joinTripByInviteCode(doomedCode, JOINER);
      await trips.joinTripByInviteCode((await trips.getInviteCodeForMember(kept, OWNER))!, JOINER);
    });

    it("lets a member delete nothing", async () => {
      await expect(trips.deleteTripForOwner(doomed, JOINER)).resolves.toBe(false);
      await expect(trips.getTripForMember(doomed, OWNER)).resolves.toMatchObject({ id: doomed });
      expect(await memberRows(doomed)).toHaveLength(2);
    });

    it("lets a stranger delete nothing, and a made-up id is the same answer", async () => {
      await expect(trips.deleteTripForOwner(doomed, STRANGER)).resolves.toBe(false);
      await expect(trips.deleteTripForOwner(`${ID_PREFIX}no-such-trip`, OWNER)).resolves.toBe(false);
      await expect(trips.getTripForMember(doomed, OWNER)).resolves.toMatchObject({ id: doomed });
      expect(await memberRows(doomed)).toHaveLength(2);
    });

    it("removes the trip, its member rows and its invite for the owner, and nothing else", async () => {
      await expect(trips.deleteTripForOwner(doomed, OWNER)).resolves.toBe(true);

      // Gone for everyone.
      await expect(trips.getTripForMember(doomed, OWNER)).resolves.toBeNull();
      await expect(trips.getTripForMember(doomed, JOINER)).resolves.toBeNull();
      expect((await trips.listMyTrips(OWNER)).map((row) => row.id)).not.toContain(doomed);
      expect((await trips.listMyTrips(JOINER)).map((row) => row.id)).not.toContain(doomed);
      expect(await memberRows(doomed)).toEqual([]);
      const rows = await dbModule.db.select().from(schema.trip).where(orm.eq(schema.trip.id, doomed));
      expect(rows).toEqual([]);

      // The old invite link opens nothing and joins nobody.
      await expect(trips.getTripByInviteCode(doomedCode)).resolves.toBeNull();
      await expect(trips.joinTripByInviteCode(doomedCode, OUTSIDER)).resolves.toBeNull();
      await expect(trips.isTripMember(doomed, OUTSIDER)).resolves.toBe(false);

      // Another trip, with the same people, is untouched.
      await expect(trips.getTripForMember(kept, OWNER)).resolves.toMatchObject({ id: kept });
      expect((await memberRows(kept)).map((row) => row.userId).sort()).toEqual([JOINER, OWNER].sort());
    });

    it("says false the second time, harmlessly", async () => {
      await expect(trips.deleteTripForOwner(doomed, OWNER)).resolves.toBe(false);
      await expect(trips.getTripForMember(kept, OWNER)).resolves.toMatchObject({ id: kept });
    });
  });

});
