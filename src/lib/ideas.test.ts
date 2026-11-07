import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIdea, deleteIdea, getIdeaForMember, listIdeasForMember, updateIdea } from "./ideas";

// The real query builder with a stand-in for the database, so these tests read the exact SQL
// the privacy layer sends. ideas.dev-db.test.ts runs it for real.
const fake = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
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
    { transaction: async (queries: Promise<unknown>[]) => Promise.all(queries) },
  );
  return { db: drizzle(client as never, { schema: { ...authSchema, ...tripSchema } }) };
});

const input = {
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: "https://maps.app.goo.gl/abc123",
  area: "District 1",
  costPerPerson: 120,
  notes: "Go early.",
};

// The update's own condition starts here; everything before it is what gets changed.
const WHERE = ' where ("idea"."id"';

beforeEach(() => {
  fake.queries.length = 0;
  fake.rows = [];
});

describe("listIdeasForMember", () => {
  it("checks the trip and membership in the query, newest first, with no email", async () => {
    await listIdeasForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"idea"."trip_id" = $1');
    expect(sql).toContain("exists");
    expect(sql).toMatch(/order by "idea"\."created_at" desc/i);
    expect(sql).not.toContain("email");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1"]));
  });

  it("gives an empty list when nothing comes back", async () => {
    await expect(listIdeasForMember("trip-1", "stranger")).resolves.toEqual([]);
  });
});

describe("getIdeaForMember", () => {
  it("asks for the idea within its own trip and checks membership in the same query", async () => {
    await getIdeaForMember("trip-1", "idea-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"idea"."id" = $1');
    expect(sql).toContain('"idea"."trip_id" = $2');
    expect(sql).toContain("exists");
    expect(sql).not.toContain("email");
    expect(params.slice(0, 2)).toEqual(["idea-1", "trip-1"]);
  });

  it("gives null when no row comes back", async () => {
    await expect(getIdeaForMember("trip-1", "idea-1", "stranger")).resolves.toBeNull();
  });
});

describe("createIdea", () => {
  it("adds the idea in one statement that reads the trip and checks membership", async () => {
    fake.rows = [["new-id"]];
    const id = await createIdea("trip-1", "u1", input);
    expect(fake.queries).toHaveLength(1);
    const [{ sql, params }] = fake.queries;
    expect(sql).toMatch(/^insert into "idea"/);
    expect(sql).toContain('from "trip"');
    expect(sql).toContain("exists");
    expect(sql).toContain("trip_member");
    // The currency comes from the trip, not from the person.
    expect(sql).toContain('else "currency" end as "cost_currency"');
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1", "Chợ Bến Thành", 120]));
    expect(id).toBe("new-id");
  });

  it("says null when the statement added nothing (a stranger, or no such trip)", async () => {
    await expect(createIdea("trip-1", "stranger", input)).resolves.toBeNull();
  });
});

describe("updateIdea", () => {
  it("puts trip, idea, membership and who-may-change in the update's own condition", async () => {
    await updateIdea("trip-1", "idea-1", "u1", input);
    const [{ sql, params }] = fake.queries;
    const at = sql.indexOf(WHERE);
    expect(at).toBeGreaterThan(0);
    const setPart = sql.slice(0, at);
    const wherePart = sql.slice(at);
    expect(wherePart).toContain('"idea"."id" =');
    expect(wherePart).toContain('"idea"."trip_id" =');
    expect(wherePart).toContain('"idea"."created_by" =');
    expect(wherePart).toContain('"trip"."owner_id" =');
    expect(wherePart).toContain("exists");
    // It never changes who added it, or which trip it is in.
    expect(setPart).not.toContain("created_by");
    expect(setPart).not.toContain('"trip_id"');
    expect(params).toEqual(expect.arrayContaining(["idea-1", "trip-1", "u1", "Chợ Bến Thành"]));
  });

  it("clears the currency together with the cost", async () => {
    await updateIdea("trip-1", "idea-1", "u1", { ...input, costPerPerson: null });
    const [{ sql }] = fake.queries;
    const setPart = sql.slice(0, sql.indexOf(WHERE));
    expect(setPart).toMatch(/"cost_currency" = /);
    expect(setPart).not.toContain('select "currency"');
  });

  it("says false when nothing changed and true when a row changed", async () => {
    await expect(updateIdea("trip-1", "idea-1", "other", input)).resolves.toBe(false);
    fake.rows = [["idea-1"]];
    await expect(updateIdea("trip-1", "idea-1", "u1", input)).resolves.toBe(true);
  });
});

describe("deleteIdea", () => {
  it("uses the same condition as update, on the idea table only", async () => {
    await deleteIdea("trip-1", "idea-1", "u1");
    expect(fake.queries).toHaveLength(1);
    const [{ sql, params }] = fake.queries;
    expect(sql).toMatch(/^delete from "idea" where/);
    expect(sql).toContain('"idea"."created_by" =');
    expect(sql).toContain('"trip"."owner_id" =');
    expect(sql).toContain('"idea"."trip_id" =');
    expect(params).toEqual(expect.arrayContaining(["idea-1", "trip-1", "u1"]));
  });

  it("says false when nothing was removed and true when an idea went", async () => {
    await expect(deleteIdea("trip-1", "idea-1", "other")).resolves.toBe(false);
    fake.rows = [["idea-1"]];
    await expect(deleteIdea("trip-1", "idea-1", "u1")).resolves.toBe(true);
  });
});
