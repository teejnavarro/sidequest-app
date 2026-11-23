import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countCostsForTrip,
  createCost,
  deleteCost,
  getBalancesForMember,
  getCostForMember,
  listCostsForMember,
  restoreCost,
  updateCost,
} from "./costs";
import type { CostInput } from "./cost-input";

// The real query builder with a stand-in for the database, so these tests read the exact
// SQL the privacy layer sends. costs.dev-db.test.ts runs it for real.
const fake = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  batches: [] as number[],
  rows: [] as unknown[][],
  queue: [] as unknown[][][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const authSchema = await import("@/db/auth-schema");
  const tripSchema = await import("@/db/trip-schema");
  const client = Object.assign(
    async (sql: string, params: unknown[]) => {
      fake.queries.push({ sql, params });
      const rows = fake.queue.length > 0 ? fake.queue.shift()! : fake.rows;
      return { rows, fields: [], rowCount: rows.length };
    },
    {
      transaction: async (queries: Promise<unknown>[]) => {
        fake.batches.push(queries.length);
        return Promise.all(queries);
      },
    },
  );
  return {
    db: drizzle(client as never, { schema: { ...authSchema, ...tripSchema } }),
  };
});

const input: CostInput = {
  description: "Dinner",
  amount: 100000,
  paidBy: "spot-a",
  category: "food",
  spentOn: "2027-03-12",
  shares: [
    { spotId: "spot-a", amount: 33334, originalAmount: null },
    { spotId: "spot-b", amount: 33333, originalAmount: null },
    { spotId: "spot-c", amount: 33333, originalAmount: null },
  ],
  money: { kind: "trip" },
};

beforeEach(() => {
  fake.queries.length = 0;
  fake.batches.length = 0;
  fake.rows = [];
  fake.queue.length = 0;
});

describe("listCostsForMember", () => {
  it("checks membership in the same query, orders newest first and returns no email", async () => {
    await listCostsForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"cost"."trip_id" = $');
    expect(sql).toContain('"viewer"."user_id" = $');
    expect(sql).toMatch(/order by "cost"\."spent_on" desc, "cost"\."created_at" desc/i);
    expect(sql).not.toContain("email");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1"]));
  });

  it("gives an empty list and a zero total when nothing comes back", async () => {
    await expect(listCostsForMember("trip-1", "stranger")).resolves.toEqual({ costs: [], total: 0, trashCount: 0 });
  });

  it("shapes each row, uses first names and adds up the total", async () => {
    fake.rows = [
      ["c1", "Taxi", 25050, "PHP", null, null, null, "2027-03-13", "spot-b", "Ben Cruz", false, false, false, "2", null, "u1", "Ana Reyes", "u2", "Ben Cruz"],
      ["c2", "Dinner", 100000, "PHP", null, null, "food", "2027-03-12", "spot-a", "Ana Reyes", false, true, false, "3", "33334", "u1", "Ana Reyes", "u1", "Ana Reyes"],
      ["c3", "Tour", 5, "PHP", null, null, "activities", "2027-03-12", "spot-g", "Dana", true, false, false, "1", "5", "u1", "Ana Reyes", "u1", "Ana Reyes"],
    ];
    const list = await listCostsForMember("trip-1", "u1");
    expect(list.total).toBe(125055);
    expect(list.costs[0]).toEqual({
      id: "c1",
      description: "Taxi",
      amount: 25050,
      currency: "PHP",
      original: null,
      category: null,
      spentOn: "2027-03-13",
      payer: { spotId: "spot-b", name: "Ben Cruz", isGuest: false, isYou: false, hasLeft: false },
      shareCount: 2,
      myShare: null,
      addedBy: "Ana",
      editedBy: "Ben",
    });
    expect(list.costs[1]).toMatchObject({ myShare: 33334, editedBy: null, payer: { isYou: true } });
    expect(list.costs[2].payer).toMatchObject({ name: "Dana", isGuest: true });
  });
});

describe("getCostForMember", () => {
  it("checks trip and membership in the query, and gives null when nothing is found", async () => {
    await expect(getCostForMember("trip-1", "c1", "stranger")).resolves.toBeNull();
    expect(fake.queries).toHaveLength(1);
    const { sql, params } = fake.queries[0];
    expect(sql).toContain('"cost"."id" = $');
    expect(sql).toContain('"cost"."trip_id" = $');
    expect(sql).toContain('"viewer"."user_id" = $');
    expect(params).toEqual(expect.arrayContaining(["c1", "trip-1", "stranger"]));
  });

  it("reads the shares with the same checks and keeps the saved time", async () => {
    const updatedAt = new Date("2027-03-12T10:00:00.123Z");
    fake.queue = [
      [["c1", "Dinner", 100000, "PHP", null, null, null, "food", "2027-03-12", "spot-a", updatedAt.toISOString().replace("T", " ").replace("Z", "")]],
      [["spot-a", 50000, null], ["spot-b", 50000, null]],
    ];
    const found = await getCostForMember("trip-1", "c1", "u1");
    expect(found).toMatchObject({
      id: "c1",
      amount: 100000,
      paidBy: "spot-a",
      original: null,
      shares: [{ spotId: "spot-a", amount: 50000, originalAmount: null }, { spotId: "spot-b", amount: 50000, originalAmount: null }],
    });
    expect(found?.updatedAt.getTime()).toBe(updatedAt.getTime());
    expect(fake.queries[1].sql).toContain('"viewer"."user_id" = $');
    expect(fake.queries[1].sql).not.toContain("email");
  });
});

describe("createCost", () => {
  it("sends the cost and each share as one all-or-nothing batch, checked inside the statements", async () => {
    fake.queue = [[["c1"]]];
    await expect(createCost("trip-1", "u1", "c1", input)).resolves.toBe("ok");
    expect(fake.batches).toEqual([4]);
    const [cost, ...shares] = fake.queries;
    expect(cost.sql).toContain('insert into "cost"');
    expect(cost.sql).toContain('"viewer"."user_id" = $');
    expect(cost.sql).toContain("on conflict do nothing");
    expect(cost.sql).toContain('count(*) from "trip_member"');
    expect(cost.params).toEqual(
      expect.arrayContaining(["c1", "trip-1", "u1", "Dinner", 100000, "spot-a", "food", "2027-03-12", 3]),
    );
    expect(shares).toHaveLength(3);
    for (const share of shares) {
      expect(share.sql).toContain('insert into "cost_share"');
      expect(share.sql).toContain('"cost"."created_at" = now()');
      expect(share.sql).toContain("on conflict do nothing");
    }
    expect(shares.map((s) => s.params)).toEqual([
      expect.arrayContaining(["spot-a", 33334]),
      expect.arrayContaining(["spot-b", 33333]),
      expect.arrayContaining(["spot-c", 33333]),
    ]);
  });

  it("counts each spot once even when the payer also shares", async () => {
    fake.queue = [[["c1"]]];
    await createCost("trip-1", "u1", "c1", input);
    expect(fake.queries[0].params).toEqual(
      expect.arrayContaining(["spot-a", "spot-b", "spot-c", 3]),
    );
  });

  it("counts the same save again as ok, and says not-found for anyone else", async () => {
    // The batch has four statements; the fifth query is the look-up afterwards.
    fake.queue = [[], [], [], [], [["c1"]]];
    await expect(createCost("trip-1", "u1", "c1", input)).resolves.toBe("ok");
    expect(fake.queries[fake.queries.length - 1].sql).toContain('"cost"."created_by" = $');
    fake.queue = [[], [], [], [], []];
    await expect(createCost("trip-1", "stranger", "c1", input)).resolves.toBe("not-found");
  });
});

describe("updateCost", () => {
  const expected = new Date("2027-03-12T10:00:00.123Z");

  it("changes the cost only when it was not saved since, then replaces its shares, in one batch", async () => {
    fake.queue = [[["c1"]]];
    await expect(updateCost("trip-1", "c1", "u1", input, expected)).resolves.toBe("ok");
    expect(fake.batches).toEqual([5]);
    const [update, remove, ...inserts] = fake.queries;
    expect(update.sql).toMatch(/^update "cost" set/);
    expect(update.sql).toContain("\"updated_by\" = $");
    expect(update.sql).toContain("\"updated_at\" = now()");
    expect(update.sql).toContain("date_trunc('milliseconds', \"cost\".\"updated_at\") = $");
    expect(update.sql).toContain('"viewer"."user_id" = $');
    expect(update.params).toEqual(
      expect.arrayContaining(["Dinner", 100000, "spot-a", "food", "2027-03-12", "u1", "c1", "trip-1", expected.toISOString()]),
    );
    expect(update.sql).not.toContain('"created_by"');
    expect(remove.sql).toMatch(/^delete from "cost_share" where/);
    expect(remove.sql).toContain('"cost"."updated_at" = now()');
    expect(inserts).toHaveLength(3);
    for (const insert of inserts) {
      expect(insert.sql).toContain('insert into "cost_share"');
      expect(insert.sql).toContain('"cost"."updated_at" = now()');
      expect(insert.sql).toContain('"cost"."updated_by" = $');
    }
  });

  it("says changed when the cost exists but did not match, and not-found when it is gone", async () => {
    // The batch has five statements; the sixth query is the look-up afterwards.
    fake.queue = [[], [], [], [], [], [["c1"]]];
    await expect(updateCost("trip-1", "c1", "u1", input, expected)).resolves.toBe("changed");
    fake.queue = [[], [], [], [], [], []];
    await expect(updateCost("trip-1", "c1", "u1", input, expected)).resolves.toBe("not-found");
  });
});

describe("deleteCost and countCostsForTrip", () => {
  it("trashes inside one membership-checked statement, true only when a cost moved", async () => {
    await expect(deleteCost("trip-1", "c1", "stranger")).resolves.toBe(false);
    fake.rows = [["c1"]];
    await expect(deleteCost("trip-1", "c1", "u1")).resolves.toBe(true);
    for (const { sql } of fake.queries) {
      expect(sql).toMatch(/^update "cost" set /);
      expect(sql).toContain('"deleted_at" = now()');
      expect(sql).toContain('"updated_at" = "cost"."updated_at"');
      expect(sql).toContain('"cost"."deleted_at" is null');
      expect(sql).toContain('"cost"."trip_id" = $');
      expect(sql).toContain('"viewer"."user_id" = $');
    }
  });

  it("restores inside one membership-checked statement, keeping the saved time", async () => {
    await expect(restoreCost("trip-1", "c1", "stranger")).resolves.toBe(false);
    fake.rows = [["c1"]];
    await expect(restoreCost("trip-1", "c1", "u1")).resolves.toBe(true);
    for (const { sql } of fake.queries) {
      expect(sql).toMatch(/^update "cost" set /);
      expect(sql).toContain('"deleted_at" = $');
      expect(sql).toContain('"updated_at" = "cost"."updated_at"');
      expect(sql).toContain('"cost"."deleted_at" is not null');
      expect(sql).toContain('"viewer"."user_id" = $');
    }
  });

  it("counts a trip's costs with membership in the query", async () => {
    fake.rows = [["3", "1"]];
    await expect(countCostsForTrip("trip-1", "u1")).resolves.toEqual({ total: 3, trashed: 1 });
    expect(fake.queries[0].sql).toContain('"viewer"."user_id" = $');
    fake.rows = [];
    await expect(countCostsForTrip("trip-1", "stranger")).resolves.toEqual({ total: 0, trashed: 0 });
  });
});

describe("getBalancesForMember", () => {
  it("checks membership and the trip currency in the same queries, and returns no email", async () => {
    await expect(getBalancesForMember("trip-1", "stranger")).resolves.toEqual({
      people: [],
      payments: [],
      total: 0,
      costCount: 0,
    });
    expect(fake.queries).toHaveLength(2);
    for (const { sql, params } of fake.queries) {
      expect(sql).toContain('"viewer"."user_id" = $');
      expect(sql).toContain('"cost"."currency" = "trip"."currency"');
      expect(sql).not.toContain("email");
      expect(params).toEqual(expect.arrayContaining(["trip-1", "stranger"]));
    }
    expect(fake.queries[0].sql).toMatch(/order by "trip_member"."joined_at" asc/i);
  });

  it("works out nets and the fewest payments, and keeps a left person who still owes", async () => {
    // spotId, id, name, image, isGuest, isYou, hasLeft, paid, share
    fake.queue = [
      [
        ["s1", "u1", "Maya Cruz", null, false, true, false, "600000", "322333"],
        ["s2", "u2", "Bea Lim", null, false, false, false, "244000", "354333"],
        ["s3", "u3", "Jun Diaz", null, false, false, false, "362000", "321000"],
        ["s4", "s4", "Dana", null, true, false, true, "100000", "308334"],
        ["s5", "u5", "Gone Even", null, false, false, true, "0", "0"],
      ],
      [["6", "1306000"]],
    ];
    const result = await getBalancesForMember("trip-1", "u1");
    expect(result.people.map((p) => [p.name, p.net, p.hasLeft, p.isGuest, p.isYou])).toEqual([
      ["Maya", 277667, false, false, true],
      ["Bea", -110333, false, false, false],
      ["Jun", 41000, false, false, false],
      ["Dana", -208334, true, true, false],
    ]);
    expect(result.payments).toEqual([
      { from: "s2", to: "s1", amount: 69333 },
      { from: "s2", to: "s3", amount: 41000 },
      { from: "s4", to: "s1", amount: 208334 },
    ]);
    expect(result.total).toBe(1306000);
    expect(result.costCount).toBe(6);
  });
});
