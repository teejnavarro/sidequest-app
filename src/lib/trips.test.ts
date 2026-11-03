import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrip,
  getInviteCodeForMember,
  getTripByInviteCode,
  getTripForMember,
  isTripMember,
  joinTripByInviteCode,
  listMyTrips,
  listTripMembers,
  updateTripForMember,
} from "./trips";

// The real query builder with a stand-in for the database, so these tests read the
// exact SQL the privacy layer sends. trips.dev-db.test.ts runs it for real.
const fake = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  batches: [] as number[],
  rows: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const authSchema = await import("@/db/auth-schema");
  const tripSchema = await import("@/db/trip-schema");
  const client = Object.assign(
    async (sql: string, params: unknown[]) => {
      fake.queries.push({ sql, params });
      return { rows: fake.rows, fields: [], rowCount: fake.rows.length };
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

const input = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  destination: null,
};

beforeEach(() => {
  fake.queries.length = 0;
  fake.batches.length = 0;
  fake.rows = [];
});

describe("listMyTrips", () => {
  it("only asks for the person's own trips, newest first, without email", async () => {
    await listMyTrips("u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('inner join "trip_member"');
    expect(sql).toContain('"trip_member"."user_id" = $1');
    expect(sql).toMatch(/order by "trip"\."created_at" desc/i);
    expect(sql).not.toContain("email");
    expect(params).toEqual(["u1"]);
  });
});

describe("getTripForMember", () => {
  it("checks trip and membership in the same query, without email", async () => {
    await getTripForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"trip"."id" = $1');
    expect(sql).toContain('"trip_member"."user_id" = $2');
    expect(sql).not.toContain("email");
    expect(params.slice(0, 2)).toEqual(["trip-1", "u1"]);
  });

  it("gives null when no row comes back", async () => {
    await expect(getTripForMember("trip-1", "stranger")).resolves.toBeNull();
  });
});

describe("createTrip", () => {
  it("sends the trip and the owner's member row as one all-or-nothing batch", async () => {
    const id = await createTrip("u1", input);
    expect(fake.batches).toEqual([2]);
    expect(fake.queries).toHaveLength(2);
    expect(fake.queries[0].sql).toContain('insert into "trip"');
    expect(fake.queries[0].params).toEqual(expect.arrayContaining([id, "u1", input.name]));
    expect(fake.queries[1].sql).toContain('insert into "trip_member"');
    expect(fake.queries[1].params).toEqual(expect.arrayContaining([id, "u1"]));
  });
});

describe("updateTripForMember", () => {
  it("requires membership inside the update and never changes the owner", async () => {
    await updateTripForMember("trip-1", "u1", input);
    const [{ sql, params }] = fake.queries;
    const [setPart, wherePart] = sql.split(" where ");
    expect(wherePart).toContain("exists");
    expect(sql).toContain('"trip_member"."user_id" =');
    expect(setPart).not.toContain("owner_id");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1", input.name]));
  });

  it("says false when nothing changed and true when a row changed", async () => {
    await expect(updateTripForMember("trip-1", "stranger", input)).resolves.toBe(false);
    fake.rows = [["trip-1"]];
    await expect(updateTripForMember("trip-1", "u1", input)).resolves.toBe(true);
  });
});

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";

describe("the list and detail queries", () => {
  it("never ask for the invite code", async () => {
    await listMyTrips("u1");
    await getTripForMember("trip-1", "u1");
    for (const { sql } of fake.queries) expect(sql).not.toContain("invite_code");
  });
});

describe("getInviteCodeForMember", () => {
  it("checks membership in the same query", async () => {
    await getInviteCodeForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"trip"."invite_code"');
    expect(sql).toContain('"trip_member"."user_id" = $2');
    expect(params.slice(0, 2)).toEqual(["trip-1", "u1"]);
  });

  it("gives null for a non-member and the code for a member", async () => {
    await expect(getInviteCodeForMember("trip-1", "stranger")).resolves.toBeNull();
    fake.rows = [[CODE]];
    await expect(getInviteCodeForMember("trip-1", "u1")).resolves.toBe(CODE);
  });
});

describe("listTripMembers", () => {
  it("checks the asker is a member inside the query, orders by join time, and skips email", async () => {
    await listTripMembers("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain("exists");
    expect(sql).toMatch(/order by "trip_member"\."joined_at" asc/i);
    expect(sql).not.toContain("email");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1"]));
  });

  it("gives an empty list when nothing comes back", async () => {
    await expect(listTripMembers("trip-1", "stranger")).resolves.toEqual([]);
  });
});

describe("getTripByInviteCode", () => {
  it("looks the trip up by code and asks only for name, dates and the owner's name", async () => {
    await getTripByInviteCode(CODE);
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"trip"."invite_code" = $1');
    expect(sql).not.toContain("email");
    expect(sql).not.toContain("trip_member");
    expect(params[0]).toBe(CODE);
  });

  it("does not touch the database for a wrong-shaped code", async () => {
    await expect(getTripByInviteCode("not-a-code")).resolves.toBeNull();
    expect(fake.queries).toHaveLength(0);
  });
});

describe("isTripMember", () => {
  it("says yes only when a row comes back", async () => {
    await expect(isTripMember("trip-1", "u1")).resolves.toBe(false);
    fake.rows = [["u1"]];
    await expect(isTripMember("trip-1", "u1")).resolves.toBe(true);
  });
});

describe("joinTripByInviteCode", () => {
  it("does nothing for a wrong-shaped code", async () => {
    await expect(joinTripByInviteCode("nope", "u1")).resolves.toBeNull();
    expect(fake.queries).toHaveLength(0);
  });

  it("adds nobody when the code opens no trip", async () => {
    await expect(joinTripByInviteCode(CODE, "u1")).resolves.toBeNull();
    expect(fake.queries).toHaveLength(1);
    expect(fake.queries[0].sql).not.toContain("insert");
  });

  it("adds the person once, harmlessly if already in, and returns the trip id", async () => {
    fake.rows = [["trip-1"]];
    await expect(joinTripByInviteCode(CODE.toUpperCase(), "u1")).resolves.toBe("trip-1");
    expect(fake.queries[0].params[0]).toBe(CODE);
    const insert = fake.queries[1];
    expect(insert.sql).toContain('insert into "trip_member"');
    expect(insert.sql).toContain("on conflict do nothing");
    expect(insert.params).toEqual(expect.arrayContaining(["trip-1", "u1"]));
  });
});
