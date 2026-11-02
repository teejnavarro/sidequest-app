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

const input = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
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
      [OWNER, MEMBER, STRANGER].map((id, index) => ({
        id,
        name: ["Maya Test", "Ben Test", "Lia Test"][index],
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
});
