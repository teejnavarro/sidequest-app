import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addIdeaToSchedule,
  addNewItem,
  getScheduleItemForMember,
  listApprovedUnscheduled,
  listScheduleForMember,
  moveScheduleItem,
  removeScheduleItem,
} from "./schedule";

// The real query builder with a stand-in for the database, so these tests read the exact SQL
// the privacy layer sends. schedule.dev-db.test.ts runs it for real.
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

const ideaInput = { kind: "idea", ideaId: "idea-1", day: "2027-05-08", slot: "morning", time: null } as const;
const newInput = {
  kind: "new",
  name: "Airport transfer",
  notes: null,
  day: "2027-05-08",
  slot: "time",
  time: "19:30",
} as const;

const NOT_SCHEDULED = 'not exists (select "id" from "schedule_item" where "schedule_item"."idea_id" = "idea"."id"';

beforeEach(() => {
  fake.queries.length = 0;
  fake.rows = [];
});

describe("listScheduleForMember", () => {
  it("checks the trip and membership in the query and returns no email", async () => {
    await listScheduleForMember("trip-1", "u1");
    const [{ sql, params }] = fake.queries;
    expect(sql).toContain('"schedule_item"."trip_id" = $');
    expect(sql).toContain("exists");
    expect(sql).toContain("trip_member");
    expect(sql).not.toContain("email");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1"]));
  });

  it("gives an empty list when nothing comes back", async () => {
    await expect(listScheduleForMember("trip-1", "stranger")).resolves.toEqual([]);
  });
});

describe("getScheduleItemForMember", () => {
  it("asks for the item within its own trip and checks membership in the same query", async () => {
    await getScheduleItemForMember("trip-1", "item-1", "u1");
    const [{ sql }] = fake.queries;
    expect(sql).toContain('"schedule_item"."id" = $');
    expect(sql).toContain('"schedule_item"."trip_id" = $');
    expect(sql).toContain("exists");
    expect(sql).not.toContain("email");
  });

  it("gives null when no row comes back", async () => {
    await expect(getScheduleItemForMember("trip-1", "item-1", "stranger")).resolves.toBeNull();
  });
});

describe("listApprovedUnscheduled", () => {
  it("lists approved ideas of this trip that are not on the schedule, for a member", async () => {
    await listApprovedUnscheduled("trip-1", "u1");
    const [{ sql }] = fake.queries;
    expect(sql).toContain('"idea"."trip_id" = $');
    expect(sql).toContain("exists");
    expect(sql).toContain('"idea"."approved_at" is not null');
    expect(sql).toContain(NOT_SCHEDULED);
  });
});

describe("addIdeaToSchedule", () => {
  it("adds in one statement that reads the idea: member, this trip, approved, not scheduled", async () => {
    fake.rows = [["new-id"]];
    const id = await addIdeaToSchedule("trip-1", "u1", ideaInput);
    expect(fake.queries).toHaveLength(1);
    const [{ sql, params }] = fake.queries;
    expect(sql).toMatch(/^insert into "schedule_item"/);
    expect(sql).toContain('from "idea"');
    expect(sql).toContain('"idea"."trip_id" = $');
    expect(sql).toContain("exists");
    expect(sql).toContain('"idea"."approved_at" is not null');
    expect(sql).toContain(NOT_SCHEDULED);
    expect(sql).toContain("on conflict");
    expect(sql).toContain("do nothing");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1", "idea-1", "2027-05-08", "morning"]));
    expect(id).toBe("new-id");
  });

  it("says null when nothing was added", async () => {
    await expect(addIdeaToSchedule("trip-1", "stranger", ideaInput)).resolves.toBeNull();
  });
});

describe("addNewItem", () => {
  it("adds in one statement that reads the trip and checks membership", async () => {
    fake.rows = [["new-id"]];
    const id = await addNewItem("trip-1", "u1", newInput);
    expect(fake.queries).toHaveLength(1);
    const [{ sql, params }] = fake.queries;
    expect(sql).toMatch(/^insert into "schedule_item"/);
    expect(sql).toContain('from "trip"');
    expect(sql).toContain("exists");
    expect(sql).toContain("trip_member");
    expect(params).toEqual(expect.arrayContaining(["trip-1", "u1", "Airport transfer", "19:30"]));
    expect(id).toBe("new-id");
  });

  it("says null when nothing was added", async () => {
    await expect(addNewItem("trip-1", "stranger", newInput)).resolves.toBeNull();
  });
});

describe("moveScheduleItem", () => {
  const WHERE = ' where ("schedule_item"."id"';

  it("puts item, trip, membership and kind in the update's own condition and records who", async () => {
    await moveScheduleItem("trip-1", "item-1", "u1", newInput);
    const [{ sql, params }] = fake.queries;
    const at = sql.indexOf(WHERE);
    expect(at).toBeGreaterThan(0);
    expect(sql.slice(0, at)).toContain('"updated_by" = $');
    expect(sql.slice(0, at)).toContain('"name" = $');
    const wherePart = sql.slice(at);
    expect(wherePart).toContain('"schedule_item"."trip_id" =');
    expect(wherePart).toContain("exists");
    expect(wherePart).toContain('"schedule_item"."idea_id" is null');
    expect(params).toEqual(expect.arrayContaining(["u1", "item-1", "trip-1"]));
  });

  it("never changes the name of an idea item, and only matches idea items", async () => {
    await moveScheduleItem("trip-1", "item-1", "u1", ideaInput);
    const [{ sql }] = fake.queries;
    const at = sql.indexOf(WHERE);
    expect(sql.slice(0, at)).not.toContain('"name" = $');
    expect(sql.slice(at)).toContain('"schedule_item"."idea_id" is not null');
  });

  it("says false when nothing changed and true when a row changed", async () => {
    await expect(moveScheduleItem("trip-1", "item-1", "stranger", newInput)).resolves.toBe(false);
    fake.rows = [["item-1"]];
    await expect(moveScheduleItem("trip-1", "item-1", "u1", newInput)).resolves.toBe(true);
  });
});

describe("removeScheduleItem", () => {
  it("deletes only within the trip, for a member", async () => {
    await removeScheduleItem("trip-1", "item-1", "u1");
    const [{ sql }] = fake.queries;
    expect(sql).toMatch(/^delete from "schedule_item"/);
    expect(sql).toContain('"schedule_item"."trip_id" =');
    expect(sql).toContain("exists");
  });

  it("says false when nothing went and true when a row went", async () => {
    await expect(removeScheduleItem("trip-1", "item-1", "stranger")).resolves.toBe(false);
    fake.rows = [["item-1"]];
    await expect(removeScheduleItem("trip-1", "item-1", "u1")).resolves.toBe(true);
  });
});
