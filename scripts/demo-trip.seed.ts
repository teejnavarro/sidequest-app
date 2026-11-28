import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, it, vi } from "vitest";

// Builds a made-up trip, "Siargao 2027", on the DEV database for the homepage screenshots.
// Run with: npm.cmd run demo:seed
//
// Safety rules (the same as the dev-db tests):
// - The database address and the Blob token come from .env.development.local and nowhere else.
//   If that file can't be used, the run stops before contacting anything.
// - The viewer ("Migs") is the spare Google account whose email is DEMO_VIEWER_EMAIL in that
//   same file. Without it the run stops and writes nothing. The email is never printed.
// - Everything goes through the app's own privacy-layer functions, so the numbers are real.
// - It is safe to run again: it first deletes only the trips and payment details that belong
//   to the made-up user "demo-bea", and the QR file of those details. It changes no other
//   user except the viewer's own row (name "Migs", no photo).
// - It prints only the trip's path.

vi.mock("server-only", () => ({}));

const BEA = "demo-bea";
const JO = "demo-jo";

function devEnv() {
  let env: Record<string, string | undefined>;
  try {
    env = parseEnv(readFileSync(".env.development.local", "utf8"));
  } catch {
    throw new Error("Stopped: could not load .env.development.local. Nothing was contacted.");
  }
  const viewerEmail = env.DEMO_VIEWER_EMAIL?.trim().toLowerCase();
  if (!viewerEmail) {
    throw new Error(
      "Stopped: no DEMO_VIEWER_EMAIL in .env.development.local. Add the spare Google account's email there, sign in once on localhost with that account, then run again. Nothing was contacted.",
    );
  }
  if (!env.DATABASE_URL || !URL.canParse(env.DATABASE_URL)) {
    throw new Error("Stopped: no usable DATABASE_URL in .env.development.local. Nothing was contacted.");
  }
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Stopped: no BLOB_READ_WRITE_TOKEN in .env.development.local. Nothing was contacted.");
  }
  return { viewerEmail, databaseUrl: env.DATABASE_URL, blobToken: env.BLOB_READ_WRITE_TOKEN };
}

// Today in the trip's time zone, as "YYYY-MM-DD", plus a number of days.
function dayFromToday(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

describe("demo trip", () => {
  it("builds Siargao 2027 for the homepage screenshots", async () => {
    const { viewerEmail, databaseUrl, blobToken } = devEnv();
    process.env.DATABASE_URL = databaseUrl;
    delete process.env.PREVIEW_DATABASE_URL;
    process.env.BLOB_READ_WRITE_TOKEN = blobToken;

    const { db } = await import("@/lib/db");
    const schema = await import("@/db/auth-schema");
    const tripSchema = await import("@/db/trip-schema");
    const { eq, sql } = await import("drizzle-orm");
    const trips = await import("@/lib/trips");
    const ideas = await import("@/lib/ideas");
    const schedule = await import("@/lib/schedule");
    const costs = await import("@/lib/costs");
    const payments = await import("@/lib/payments");
    const { putImage, deleteImages } = await import("@/lib/blob-store");
    const { splitEqually } = await import("@/lib/money");

    // The viewer must exist already (signed in once on localhost).
    const viewerRows = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(sql`lower(${schema.user.email}) = ${viewerEmail}`)
      .limit(1);
    const viewerId = viewerRows[0]?.id;
    if (!viewerId) throw new Error("Sign in once on localhost with the demo account, then run again.");
    if (viewerId === BEA || viewerId === JO) throw new Error("Stopped: the viewer can't be a made-up user.");

    // 1. Clear the last run: only what belongs to the made-up owner.
    const oldTrips = await db
      .select({ id: tripSchema.trip.id })
      .from(tripSchema.trip)
      .where(eq(tripSchema.trip.ownerId, BEA));
    for (const old of oldTrips) await trips.deleteTripForOwner(old.id, BEA);
    for (const account of await payments.listMyPaymentAccounts(BEA)) {
      const removed = await payments.deletePaymentAccount(BEA, account.id);
      if (removed !== "not-found" && removed.qrPath) await deleteImages([removed.qrPath]);
    }

    // 2. The people. The viewer is renamed "Migs" and loses any photo.
    for (const [id, name] of [
      [BEA, "Bea"],
      [JO, "Jo"],
    ] as const) {
      await db
        .insert(schema.user)
        .values({ id, name, email: `${name.toLowerCase()}@demo.invalid`, emailVerified: true, image: null })
        .onConflictDoUpdate({ target: schema.user.id, set: { name, image: null } });
    }
    await db.update(schema.user).set({ name: "Migs", image: null }).where(eq(schema.user.id, viewerId));

    // 3. The trip, who is in it, and the guest.
    const start = dayFromToday(12);
    const days = [0, 1, 2, 3, 4].map((offset) => dayFromToday(12 + offset));
    const tripId = await trips.createTrip(BEA, {
      name: "Siargao 2027",
      startDate: start,
      endDate: days[4]!,
      timeZone: "Asia/Manila",
      currency: "PHP",
      destination: "Siargao",
    });
    const code = await trips.getInviteCodeForMember(tripId, BEA);
    if (!code) throw new Error("The trip has no invite code.");
    for (const userId of [viewerId, JO]) {
      const joined = await trips.joinTripByInviteCode(code, userId);
      if (!joined || joined === "taken") throw new Error("Could not add a person to the trip.");
    }
    if ((await trips.addGuest(tripId, BEA, "Rica")) !== "ok") throw new Error("Could not add the guest.");

    const people = await trips.listTripMembers(tripId, BEA);
    const spot = (name: string) => {
      const found = people.find((person) => person.name === name);
      if (!found) throw new Error(`Missing person in the trip: ${name}`);
      return found.spotId;
    };
    const spots = { bea: spot("Bea"), migs: spot("Migs"), jo: spot("Jo"), rica: spot("Rica") };

    // 4. Ideas, votes and approvals. Guests can't vote, so counts come from Bea, Migs and Jo.
    async function idea(input: {
      name: string;
      type: string;
      duration: string;
      area: string;
      cost: number | null;
      notes: string | null;
    }) {
      const id = await ideas.createIdea(tripId, BEA, {
        name: input.name,
        type: input.type,
        duration: input.duration,
        link: null,
        area: input.area,
        costPerPerson: input.cost,
        notes: input.notes,
      });
      if (!id) throw new Error("Could not add an idea.");
      return id;
    }
    const hopping = await idea({
      name: "Island hopping",
      type: "adventure",
      duration: "full",
      area: "Naked Island",
      cost: 1500,
      notes: "Naked Island, Daku and Guyam in one day.",
    });
    const surf = await idea({
      name: "Surf lesson at Cloud 9",
      type: "adventure",
      duration: "short",
      area: "Cloud 9",
      cost: 700,
      notes: null,
    });
    const sunset = await idea({
      name: "Sunset at Maasin River",
      type: "sightseeing",
      duration: "short",
      area: "Maasin River",
      cost: null,
      notes: null,
    });
    const vote = async (ideaId: string, userId: string, choice: 1 | -1) => {
      if (!(await ideas.setVote(tripId, ideaId, userId, choice))) throw new Error("A vote was refused.");
    };
    for (const userId of [BEA, viewerId, JO]) await vote(hopping, userId, 1);
    await vote(surf, BEA, 1);
    await vote(surf, JO, 1);
    await vote(surf, viewerId, -1);
    await vote(sunset, BEA, 1);
    await vote(sunset, viewerId, 1);
    // An idea must be approved before it can go on a day.
    for (const id of [hopping, surf, sunset]) await ideas.approveIdea(tripId, id, BEA);

    // 5. The schedule: Day 2 and Day 3 (the second and third trip days).
    const placed = [
      await schedule.addIdeaToSchedule(tripId, BEA, { kind: "idea", ideaId: surf, day: days[1]!, slot: "morning", time: null }),
      await schedule.addNewItem(tripId, BEA, { kind: "new", name: "Lunch at Kermit", notes: null, day: days[1]!, slot: "time", time: "13:00" }),
      await schedule.addIdeaToSchedule(tripId, BEA, { kind: "idea", ideaId: sunset, day: days[1]!, slot: "evening", time: null }),
      await schedule.addIdeaToSchedule(tripId, BEA, { kind: "idea", ideaId: hopping, day: days[2]!, slot: "full", time: null }),
    ];
    if (placed.some((id) => !id)) throw new Error("Could not fill the schedule.");

    // 6. Costs. Money is in centavos. Everything goes through createCost, so the balances are real.
    const everyone = [spots.bea, spots.migs, spots.jo, spots.rica];
    async function addCost(args: {
      by: { userId: string; spotId: string };
      description: string;
      category: string;
      pesos: number;
      day: string;
      shares?: Record<string, number>; // spot id -> centavos, for an uneven split
      among?: string[];
    }) {
      const amount = args.pesos * 100;
      const base = args.shares
        ? Object.entries(args.shares).map(([spotId, share]) => ({ spotId, amount: share }))
        : splitEqually(amount, args.among ?? everyone, args.by.spotId);
      const result = await costs.createCost(tripId, args.by.userId, crypto.randomUUID(), {
        description: args.description,
        amount,
        paidBy: args.by.spotId,
        category: args.category,
        spentOn: args.day,
        shares: base.map((share) => ({ ...share, originalAmount: null })),
        money: { kind: "trip" },
      });
      if (result !== "ok") throw new Error(`Could not add the cost "${args.description}".`);
    }
    const bea = { userId: BEA, spotId: spots.bea };
    const migs = { userId: viewerId, spotId: spots.migs };
    const jo = { userId: JO, spotId: spots.jo };
    await addCost({ by: bea, description: "Van to General Luna", category: "transport", pesos: 3200, day: days[0]! });
    await addCost({ by: migs, description: "Island hopping boat", category: "activities", pesos: 6000, day: days[2]! });
    await addCost({
      by: migs,
      description: "Dinner at Shaka",
      category: "food",
      pesos: 2400,
      day: days[1]!,
      shares: { [spots.bea]: 70000, [spots.migs]: 80000, [spots.jo]: 90000 },
    });
    await addCost({ by: bea, description: "Surf lesson at Cloud 9", category: "activities", pesos: 2800, day: days[1]! });
    await addCost({ by: jo, description: "Lunch at Kermit", category: "food", pesos: 1800, day: days[1]! });
    await addCost({ by: migs, description: "Cottage stay", category: "lodging", pesos: 5200, day: days[0]! });
    await addCost({
      by: jo,
      description: "Airport van",
      category: "transport",
      pesos: 3300,
      day: days[0]!,
      among: [spots.migs, spots.rica],
    });

    // 7. Bea's made-up GCash details with the fake QR in the dev Blob store.
    const qr = await putImage("qr", new Uint8Array(readFileSync("scripts/demo-qr.jpg")));
    const saved = await payments.createPaymentAccount(
      BEA,
      { kind: "gcash", accountName: "B. Santos", number: "09170000000" },
      qr,
    );
    if (saved !== "ok") throw new Error("Could not save the made-up payment details.");

    // 8. Check what the screenshots rely on: Migs is owed, and the settle-up has "Jo pays Bea".
    const balances = await costs.getBalancesForMember(tripId, viewerId);
    const you = balances.people.find((person) => person.isYou);
    if (!you || you.net <= 0) throw new Error("Check failed: Migs should be owed money.");
    if (!balances.payments.some((line) => line.from === spots.jo && line.to === spots.bea)) {
      throw new Error("Check failed: the settle-up should contain Jo paying Bea.");
    }

    console.log(`Demo trip ready: /trips/${tripId}/schedule`);
  });
});
