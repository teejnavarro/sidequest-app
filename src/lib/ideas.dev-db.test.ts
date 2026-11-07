import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Runs the ideas privacy layer against the real dev database, with made-up people and trips
// that are deleted afterwards. Run with: npm.cmd run test:dev-db
//
// Safety rules (the same as trips.dev-db.test.ts):
// - The address comes from .env.development.local and nowhere else. No fallback: if that
//   file can't be used, the run stops before connecting to anything.
// - Nothing prints the address.
// - Every row this test adds has an id starting with ID_PREFIX, and cleanup removes only
//   those rows, including any left by an earlier run that crashed. (The prefix differs from
//   the trips test, so the two files can run at the same time without touching each other.)

vi.mock("server-only", () => ({}));

const ID_PREFIX = "qa-dev-ideas-";
const RUN = crypto.randomUUID();
const OWNER = `${ID_PREFIX}owner-${RUN}`;
const ADDER = `${ID_PREFIX}adder-${RUN}`;
const OTHER = `${ID_PREFIX}other-${RUN}`;
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
  link: "https://maps.app.goo.gl/abc123",
  area: "District 1",
  costPerPerson: 120,
  notes: "Go early.\nBring small notes.",
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

describe("ideas privacy layer on the dev database", () => {
  let dbModule: typeof import("./db");
  let trips: typeof import("./trips");
  let ideas: typeof import("./ideas");
  let schema: typeof import("@/db/trip-schema") & typeof import("@/db/auth-schema");
  let orm: typeof import("drizzle-orm");
  let tripA: string; // owned by OWNER; ADDER and OTHER are members
  let tripB: string; // a different group, owned by OWNER_TWO

  async function cleanUp() {
    const { db } = dbModule;
    const { like } = orm;
    // Votes first: they point at test users. Deleting a trip also deletes its member rows,
    // its ideas and their votes.
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
    schema = {
      ...(await import("@/db/trip-schema")),
      ...(await import("@/db/auth-schema")),
    };
    orm = await import("drizzle-orm");

    await dbModule.db.insert(schema.user).values(
      [OWNER, ADDER, OTHER, STRANGER, OWNER_TWO].map((id, index) => ({
        id,
        name: ["Maya Test", "Ben Test", "Lia Test", "Cho Test", "Rey Test"][index],
        email: `${id}@example.test`,
      })),
    );
    tripA = await trips.createTrip(OWNER, tripInput);
    tripB = await trips.createTrip(OWNER_TWO, { ...tripInput, name: "Another group", currency: "PHP" });
    await dbModule.db.insert(schema.tripMember).values([
      { tripId: tripA, userId: ADDER },
      { tripId: tripA, userId: OTHER },
    ]);
  });

  afterAll(async () => {
    if (!dbModule) return;
    await cleanUp();
    const { like } = orm;
    const { db } = dbModule;
    expect(await db.select().from(schema.user).where(like(schema.user.id, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.trip).where(like(schema.trip.ownerId, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.idea).where(like(schema.idea.createdBy, `${ID_PREFIX}%`))).toEqual([]);
    expect(await db.select().from(schema.ideaVote).where(like(schema.ideaVote.userId, `${ID_PREFIX}%`))).toEqual([]);
  });

  it("lets a member add an idea and keeps the accents and line breaks exactly", async () => {
    const id = await ideas.createIdea(tripA, ADDER, ideaInput);
    expect(id).toEqual(expect.any(String));

    const found = await ideas.getIdeaForMember(tripA, id!, ADDER);
    expect(found).toMatchObject({
      id,
      name: "Chợ Bến Thành",
      type: "sightseeing",
      duration: "half",
      link: "https://maps.app.goo.gl/abc123",
      area: "District 1",
      costPerPerson: 120,
      notes: "Go early.\nBring small notes.",
      addedBy: { id: ADDER, name: "Ben Test", image: null },
    });
    // The cost is saved with the trip's currency.
    expect(found?.costCurrency).toBe("VND");
  });

  it("stores blank optional fields as null, with no currency when there is no cost", async () => {
    const id = await ideas.createIdea(tripA, ADDER, {
      name: "Phở Hòa Pasteur",
      type: "food",
      duration: "short",
      link: null,
      area: null,
      costPerPerson: null,
      notes: null,
    });
    const found = await ideas.getIdeaForMember(tripA, id!, ADDER);
    expect(found).toMatchObject({
      name: "Phở Hòa Pasteur",
      link: null,
      area: null,
      costPerPerson: null,
      costCurrency: null,
      notes: null,
    });
  });

  it("lists ideas newest first, with who added each, and never an email", async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    const newest = (await ideas.createIdea(tripA, OTHER, { ...ideaInput, name: "Newest idea" }))!;
    const listed = await ideas.listIdeasForMember(tripA, OWNER);
    expect(listed[0].id).toBe(newest);
    expect(listed[0].addedBy.name).toBe("Lia Test");
    expect(listed.map((row) => row.name)).toContain("Chợ Bến Thành");
    const times = listed.map((row) => row.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(JSON.stringify(listed)).not.toContain("@example.test");
  });

  it("gives a stranger nothing: no list, no idea, and nothing can be added", async () => {
    const [anIdea] = await ideas.listIdeasForMember(tripA, OWNER);
    await expect(ideas.listIdeasForMember(tripA, STRANGER)).resolves.toEqual([]);
    await expect(ideas.getIdeaForMember(tripA, anIdea.id, STRANGER)).resolves.toBeNull();
    await expect(ideas.createIdea(tripA, STRANGER, ideaInput)).resolves.toBeNull();
    await expect(ideas.updateIdea(tripA, anIdea.id, STRANGER, ideaInput)).resolves.toBe(false);
    await expect(ideas.deleteIdea(tripA, anIdea.id, STRANGER)).resolves.toBe(false);
    // Nothing was added by the stranger's try.
    const after = await ideas.listIdeasForMember(tripA, OWNER);
    expect(after.some((row) => row.addedBy.id === STRANGER)).toBe(false);
  });

  it("keeps two groups apart: ideas, ids and trip addresses never cross", async () => {
    const inB = (await ideas.createIdea(tripB, OWNER_TWO, { ...ideaInput, name: "Group B idea" }))!;
    const [inA] = await ideas.listIdeasForMember(tripA, OWNER);

    await expect(ideas.listIdeasForMember(tripB, OWNER)).resolves.toEqual([]);
    expect((await ideas.listIdeasForMember(tripB, OWNER_TWO)).map((row) => row.name)).toEqual(["Group B idea"]);
    expect((await ideas.listIdeasForMember(tripA, OWNER)).map((row) => row.name)).not.toContain("Group B idea");

    // An idea id from the other trip, asked for through your own trip, finds nothing.
    await expect(ideas.getIdeaForMember(tripA, inB, OWNER)).resolves.toBeNull();
    await expect(ideas.getIdeaForMember(tripB, inA.id, OWNER_TWO)).resolves.toBeNull();
    await expect(ideas.updateIdea(tripA, inB, OWNER, ideaInput)).resolves.toBe(false);
    await expect(ideas.deleteIdea(tripA, inB, OWNER)).resolves.toBe(false);
    // Using another trip's address with your own idea id changes nothing either.
    await expect(ideas.updateIdea(tripB, inA.id, OWNER_TWO, ideaInput)).resolves.toBe(false);
    await expect(ideas.deleteIdea(tripB, inA.id, OWNER_TWO)).resolves.toBe(false);
    // Group B's currency is its own.
    expect((await ideas.getIdeaForMember(tripB, inB, OWNER_TWO))?.costCurrency).toBe("PHP");
  });

  it("lets the adder and the trip owner change an idea, and nobody else", async () => {
    const id = (await ideas.createIdea(tripA, ADDER, { ...ideaInput, name: "Adder's idea" }))!;

    // Another member may see it but not change it.
    await expect(ideas.getIdeaForMember(tripA, id, OTHER)).resolves.toMatchObject({ canChange: false });
    await expect(ideas.updateIdea(tripA, id, OTHER, { ...ideaInput, name: "Hijacked" })).resolves.toBe(false);
    await expect(ideas.deleteIdea(tripA, id, OTHER)).resolves.toBe(false);
    await expect(ideas.getIdeaForMember(tripA, id, ADDER)).resolves.toMatchObject({ name: "Adder's idea" });

    // The adder can.
    await expect(ideas.getIdeaForMember(tripA, id, ADDER)).resolves.toMatchObject({ canChange: true });
    await expect(
      ideas.updateIdea(tripA, id, ADDER, { ...ideaInput, name: "Đã sửa", costPerPerson: null }),
    ).resolves.toBe(true);
    const edited = await ideas.getIdeaForMember(tripA, id, ADDER);
    expect(edited).toMatchObject({ name: "Đã sửa", costPerPerson: null, costCurrency: null });
    expect(edited?.addedBy.id).toBe(ADDER); // who added it never changes

    // So can the trip owner, and the adder is still shown as the adder.
    await expect(ideas.getIdeaForMember(tripA, id, OWNER)).resolves.toMatchObject({ canChange: true });
    await expect(
      ideas.updateIdea(tripA, id, OWNER, { ...ideaInput, name: "Owner edit", costPerPerson: 300 }),
    ).resolves.toBe(true);
    const byOwner = await ideas.getIdeaForMember(tripA, id, OWNER);
    expect(byOwner).toMatchObject({ name: "Owner edit", costPerPerson: 300, costCurrency: "VND" });
    expect(byOwner?.addedBy.id).toBe(ADDER);
  });

  it("deletes for the adder and for the owner, never for another member, and repeats harmlessly", async () => {
    const byAdder = (await ideas.createIdea(tripA, ADDER, ideaInput))!;
    const byOther = (await ideas.createIdea(tripA, OTHER, ideaInput))!;

    await expect(ideas.deleteIdea(tripA, byAdder, OTHER)).resolves.toBe(false);
    await expect(ideas.getIdeaForMember(tripA, byAdder, ADDER)).resolves.not.toBeNull();

    await expect(ideas.deleteIdea(tripA, byAdder, ADDER)).resolves.toBe(true);
    await expect(ideas.getIdeaForMember(tripA, byAdder, OWNER)).resolves.toBeNull();
    await expect(ideas.deleteIdea(tripA, byAdder, ADDER)).resolves.toBe(false);

    await expect(ideas.deleteIdea(tripA, byOther, OWNER)).resolves.toBe(true);
    await expect(ideas.getIdeaForMember(tripA, byOther, OTHER)).resolves.toBeNull();
  });

  it("removes a trip's ideas when the trip is deleted, and nobody else's", async () => {
    const doomedTrip = await trips.createTrip(OWNER, { ...tripInput, name: "Doomed trip" });
    const doomedIdea = (await ideas.createIdea(doomedTrip, OWNER, ideaInput))!;
    const survivor = (await ideas.listIdeasForMember(tripB, OWNER_TWO))[0];

    await expect(trips.deleteTripForOwner(doomedTrip, OWNER)).resolves.toBe(true);

    const rows = await dbModule.db
      .select()
      .from(schema.idea)
      .where(orm.eq(schema.idea.id, doomedIdea));
    expect(rows).toEqual([]);
    await expect(ideas.getIdeaForMember(tripB, survivor.id, OWNER_TWO)).resolves.not.toBeNull();
  });

  it("lets a member vote, take it back, switch, and keeps one vote per person", async () => {
    const id = (await ideas.createIdea(tripA, ADDER, { ...ideaInput, name: "Vote me" }))!;
    await expect(ideas.setVote(tripA, id, OTHER, 1)).resolves.toEqual({ up: 1, down: 0, myVote: 1 });
    // The same thumb again takes it back.
    await expect(ideas.setVote(tripA, id, OTHER, 1)).resolves.toEqual({ up: 0, down: 0, myVote: null });
    await expect(ideas.setVote(tripA, id, OTHER, 1)).resolves.toEqual({ up: 1, down: 0, myVote: 1 });
    // The other thumb switches it: still one vote.
    await expect(ideas.setVote(tripA, id, OTHER, -1)).resolves.toEqual({ up: 0, down: 1, myVote: -1 });
    // A second person adds to the counts; each sees only their own vote.
    await expect(ideas.setVote(tripA, id, OWNER, 1)).resolves.toEqual({ up: 1, down: 1, myVote: 1 });
    const rows = await dbModule.db.select().from(schema.ideaVote).where(orm.eq(schema.ideaVote.ideaId, id));
    expect(rows).toHaveLength(2);
    const asOther = (await ideas.listIdeasForMember(tripA, OTHER)).find((row) => row.id === id);
    expect(asOther).toMatchObject({ up: 1, down: 1, myVote: -1 });
    const asAdder = (await ideas.getIdeaForMember(tripA, id, ADDER))!;
    expect(asAdder).toMatchObject({ up: 1, down: 1, myVote: null });
    expect(JSON.stringify(asOther)).not.toContain(OWNER); // never who voted
  });

  it("does not let a stranger vote, or vote across trips", async () => {
    const id = (await ideas.createIdea(tripA, ADDER, { ...ideaInput, name: "Stranger test" }))!;
    await expect(ideas.setVote(tripA, id, STRANGER, 1)).resolves.toBeNull();
    // Member of trip B, but the idea is in trip A, and the address says B.
    await expect(ideas.setVote(tripB, id, OWNER_TWO, 1)).resolves.toBeNull();
    await expect(ideas.setVote(tripA, id, OWNER_TWO, 1)).resolves.toBeNull();
    const rows = await dbModule.db.select().from(schema.ideaVote).where(orm.eq(schema.ideaVote.ideaId, id));
    expect(rows).toEqual([]);
  });

  it("approves and moves back for any member, and repeating is harmless", async () => {
    const id = (await ideas.createIdea(tripA, ADDER, { ...ideaInput, name: "Approve me" }))!;
    await expect(ideas.approveIdea(tripA, id, STRANGER)).resolves.toBe(false);
    await expect(ideas.approveIdea(tripB, id, OWNER_TWO)).resolves.toBe(false);
    await expect(ideas.approveIdea(tripA, id, OTHER)).resolves.toBe(true);
    // Approving twice changes nothing: the first approver stays.
    await expect(ideas.approveIdea(tripA, id, OWNER)).resolves.toBe(false);
    const approved = await ideas.getIdeaForMember(tripA, id, ADDER);
    expect(approved?.approvedAt).toBeInstanceOf(Date);
    expect(approved?.approvedBy).toEqual({ id: OTHER, name: "Lia Test" });
    // Voting continues on approved ideas.
    await expect(ideas.setVote(tripA, id, ADDER, 1)).resolves.toMatchObject({ up: 1 });

    await expect(ideas.unapproveIdea(tripA, id, STRANGER)).resolves.toBe(false);
    await expect(ideas.unapproveIdea(tripA, id, ADDER)).resolves.toBe(true);
    await expect(ideas.unapproveIdea(tripA, id, ADDER)).resolves.toBe(false);
    const back = await ideas.getIdeaForMember(tripA, id, ADDER);
    expect(back).toMatchObject({ approvedAt: null, approvedBy: null });
  });

  it("still shows who approved an idea after that person leaves the trip", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Leaver trip" });
    await dbModule.db.insert(schema.tripMember).values({ tripId: trip, userId: OTHER });
    const id = (await ideas.createIdea(trip, OWNER, { ...ideaInput, name: "Approved then left" }))!;
    await expect(ideas.approveIdea(trip, id, OTHER)).resolves.toBe(true);
    // Leaving a trip (SQ-006) removes the member row; this does the same directly.
    await dbModule.db
      .delete(schema.tripMember)
      .where(orm.and(orm.eq(schema.tripMember.tripId, trip), orm.eq(schema.tripMember.userId, OTHER)));
    const row = (await ideas.listIdeasForMember(trip, OWNER)).find((item) => item.id === id);
    expect(row?.approvedBy).toEqual({ id: OTHER, name: "Lia Test" });
    // Having left, they can no longer move it back or vote on it.
    await expect(ideas.unapproveIdea(trip, id, OTHER)).resolves.toBe(false);
    await expect(ideas.setVote(trip, id, OTHER, 1)).resolves.toBeNull();
  });

  it("orders by score, then thumbs up, then newest", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Order trip" });
    await dbModule.db.insert(schema.tripMember).values([
      { tripId: trip, userId: ADDER },
      { tripId: trip, userId: OTHER },
    ]);
    const make = async (name: string) => {
      const id = (await ideas.createIdea(trip, OWNER, { ...ideaInput, name }))!;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return id;
    };
    await make("oldest");
    const plusOne = await make("plus one"); // +1 (1 up)
    const twoUpOneDown = await make("two up one down"); // +1 (2 up)
    await make("newest");
    const minus = await make("minus"); // -1
    await ideas.setVote(trip, plusOne, OWNER, 1);
    await ideas.setVote(trip, twoUpOneDown, OWNER, 1);
    await ideas.setVote(trip, twoUpOneDown, ADDER, 1);
    await ideas.setVote(trip, twoUpOneDown, OTHER, -1);
    await ideas.setVote(trip, minus, OWNER, -1);
    const names = (await ideas.listIdeasForMember(trip, OWNER)).map((row) => row.name);
    // Both +1 ideas first (more thumbs up wins the tie), then 0 votes newest first, then -1.
    expect(names).toEqual(["two up one down", "plus one", "newest", "oldest", "minus"]);
  }, 30_000);

  it("removes an idea's votes when the idea or the trip is deleted", async () => {
    const trip = await trips.createTrip(OWNER, { ...tripInput, name: "Votes go trip" });
    const gone = (await ideas.createIdea(trip, OWNER, ideaInput))!;
    const gone2 = (await ideas.createIdea(trip, OWNER, ideaInput))!;
    await ideas.setVote(trip, gone, OWNER, 1);
    await ideas.setVote(trip, gone2, OWNER, -1);
    await ideas.deleteIdea(trip, gone, OWNER);
    const votesOf = (id: string) =>
      dbModule.db.select().from(schema.ideaVote).where(orm.eq(schema.ideaVote.ideaId, id));
    await expect(votesOf(gone)).resolves.toEqual([]);
    await expect(votesOf(gone2)).resolves.toHaveLength(1);
    await trips.deleteTripForOwner(trip, OWNER);
    await expect(votesOf(gone2)).resolves.toEqual([]);
  });

  it("round-trips emoji and unusual characters unchanged", async () => {
    const name = "Bánh mì 🥖 Huỳnh Hoa — “No. 1”";
    const id = (await ideas.createIdea(tripA, OWNER, { ...ideaInput, name }))!;
    expect((await ideas.getIdeaForMember(tripA, id, OWNER))?.name).toBe(name);
  });
});
