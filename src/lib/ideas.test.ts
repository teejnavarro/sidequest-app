import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveIdea,
  createIdea,
  deleteIdea,
  getIdeaForMember,
  listIdeasForMember,
  setVote,
  unapproveIdea,
  updateIdea,
} from "./ideas";

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
  it("checks the trip and membership in the query, most liked first, with no email", async () => {
    await listIdeasForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"idea"."trip_id" = $2');
    expect(sql).toContain("exists");
    // Score, then thumbs up, then newest.
    expect(sql).toMatch(/order by \(select coalesce\(sum\([^]*\) desc, \(select count\(\*\) filter[^]*\) desc, "idea"\."created_at" desc/i);
    expect(sql).toContain("filter (where");
    // Counts and the viewer's own vote only: never the voters' ids in the output.
    expect(sql).not.toContain('"idea_vote"."user_id" as');
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
    expect(sql).toContain('"idea"."id" = $2');
    expect(sql).toContain('"idea"."trip_id" = $3');
    expect(sql).toContain("exists");
    expect(sql).not.toContain("email");
    expect(params.slice(0, 3)).toEqual(["u1", "idea-1", "trip-1"]);
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

describe("setVote", () => {
  const counts = [[2, 1, 1]];

  it("takes the vote back when the same thumb is tapped again", async () => {
    fake.rows = [["idea-1"]]; // the delete found the matching vote
    const result = await setVote("trip-1", "idea-1", "u1", 1);
    const [first] = fake.queries;
    expect(first.sql).toMatch(/^delete from "idea_vote" where/);
    expect(first.sql).toContain('"idea_vote"."value" =');
    expect(first.sql).toContain("exists");
    expect(first.sql).toContain("trip_member");
    expect(fake.queries).toHaveLength(2); // delete, then the read; no insert
    expect(fake.queries[1].sql).toMatch(/^select/);
    expect(result).not.toBeUndefined();
  });

  it("adds or switches in one statement that checks the trip and membership", async () => {
    await setVote("trip-1", "idea-1", "u1", -1);
    expect(fake.queries).toHaveLength(3); // delete (nothing), insert, read
    const insert = fake.queries[1];
    expect(insert.sql).toMatch(/^insert into "idea_vote"/);
    expect(insert.sql).toContain('from "idea"');
    expect(insert.sql).toContain("exists");
    expect(insert.sql).toContain("trip_member");
    expect(insert.sql).toMatch(/on conflict \("idea_id","user_id"\) do update set "value" = /);
    expect(insert.params).toEqual(expect.arrayContaining(["idea-1", "trip-1", "u1", -1]));
  });

  it("gives back null when the person may not vote (no row to read)", async () => {
    await expect(setVote("trip-1", "idea-1", "stranger", 1)).resolves.toBeNull();
  });

  it("gives back the counts and the person's own vote", async () => {
    fake.rows = counts;
    await expect(setVote("trip-1", "idea-1", "u1", 1)).resolves.toEqual({ up: 2, down: 1, myVote: 1 });
  });
});

describe("approveIdea", () => {
  it("only approves a not-yet-approved idea of this trip, for a member", async () => {
    await approveIdea("trip-1", "idea-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toMatch(/^update "idea" set "approved_at" = /);
    expect(sql).toContain('"approved_by" =');
    expect(sql).toContain('"idea"."trip_id" =');
    expect(sql).toContain("exists");
    expect(sql).toContain('"idea"."approved_at" is null');
    expect(sql).not.toContain("created_by");
    expect(params).toEqual(expect.arrayContaining(["idea-1", "trip-1", "u1"]));
  });

  it("says false when nothing changed and true when a row changed", async () => {
    await expect(approveIdea("trip-1", "idea-1", "stranger")).resolves.toBe(false);
    fake.rows = [["idea-1"]];
    await expect(approveIdea("trip-1", "idea-1", "u1")).resolves.toBe(true);
  });
});

describe("unapproveIdea", () => {
  it("clears both approval columns, only on an approved idea of this trip, for a member", async () => {
    await unapproveIdea("trip-1", "idea-1", "u1");
    const [{ sql }] = fake.queries;
    expect(sql).toMatch(/^update "idea" set "approved_at" = \$1, "approved_by" = \$2/);
    expect(sql).toContain('"idea"."trip_id" =');
    expect(sql).toContain("exists");
    expect(sql).toContain('"idea"."approved_at" is not null');
  });

  it("says false when nothing changed and true when a row changed", async () => {
    await expect(unapproveIdea("trip-1", "idea-1", "stranger")).resolves.toBe(false);
    fake.rows = [["idea-1"]];
    await expect(unapproveIdea("trip-1", "idea-1", "u1")).resolves.toBe(true);
  });
});
