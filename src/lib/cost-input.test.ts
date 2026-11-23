import { describe, expect, it } from "vitest";
import { COST_CATEGORIES, costCategoryOf, isCostCategory } from "./cost-options";
import { splitOwnRule, validateCostInput } from "./cost-input";

const context = { currency: "PHP", spotIds: ["a", "b", "c"], names: { a: "You", b: "Ben", c: "Dana" } };

const valid = {
  description: "Dinner at Bún Chả",
  amount: "1,000",
  paidBy: "a",
  sharedBy: ["a", "b", "c"],
  spentOn: "2027-03-12",
  category: "food",
};

function errorsFor(overrides: Record<string, unknown>, ctx = context) {
  const result = validateCostInput({ ...valid, ...overrides }, ctx);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

function valueFor(overrides: Record<string, unknown>, ctx = context) {
  const result = validateCostInput({ ...valid, ...overrides }, ctx);
  if (!result.ok) throw new Error("expected ok: " + JSON.stringify(result.errors));
  return result.value;
}

describe("uneven splits (own amounts)", () => {
  const items = (own: Record<string, string>, overrides: Record<string, unknown> = {}) => ({
    split: "items",
    own,
    ...overrides,
  });

  it("is each person's own amount plus an equal part of the rest, and keeps ownParts for the review", () => {
    const ok = validateCostInput(
      { ...valid, amount: "1,860", paidBy: "b", ...items({ a: "700", b: "", c: "300" }) },
      context,
    );
    if (!ok.ok) throw new Error(JSON.stringify(ok.errors));
    // rest 860 / 3 = 286.66 and 2 centavos over: the payer (Ben) and then You take one each
    expect(ok.value.shares).toEqual([
      { spotId: "a", amount: 98667, originalAmount: null },
      { spotId: "b", amount: 28667, originalAmount: null },
      { spotId: "c", amount: 58666, originalAmount: null },
    ]);
    expect(ok.value.shares.reduce((s, x) => s + x.amount, 0)).toBe(186000);
    expect(ok.value.ownParts).toEqual({ a: 70000, c: 30000 });
  });

  it("ignores the own boxes for an equal split, with ownParts null", () => {
    const v = valueFor({ split: "equal", own: { a: "abc", b: "9999999" } });
    expect(v.shares.map((s) => s.amount)).toEqual([33334, 33333, 33333]);
    expect(v.ownParts).toBeNull();
    expect(valueFor({}).ownParts).toBeNull();
  });

  it("treats zero as an empty box", () => {
    const v = valueFor(items({ a: "0", b: "0.00", c: "100" }));
    expect(v.ownParts).toEqual({ c: 10000 });
  });

  it("allows rest 0 when everyone ticked has an amount", () => {
    const v = valueFor(items({ a: "400", b: "300", c: "300" }));
    expect(v.shares.map((s) => s.amount)).toEqual([40000, 30000, 30000]);
  });

  it("reports a bad amount for the first person with one", () => {
    expect(errorsFor(items({ a: "1.2.3", b: "x" })).own).toBe(
      "Check your amount. Enter an amount, like 1,250.50.",
    );
    expect(errorsFor(items({ b: "x" })).own).toBe("Check Ben's amount. Enter an amount, like 1,250.50.");
  });

  it("refuses an amount for someone who is not ticked", () => {
    expect(errorsFor(items({ c: "100" }, { sharedBy: ["a", "b"] })).own).toBe(
      "Tick Dana in Split between, or clear their amount.",
    );
    expect(errorsFor(items({ a: "100" }, { sharedBy: ["b", "c"] })).own).toBe(
      "Tick yourself in Split between, or clear your amount.",
    );
  });

  it("says how much the own amounts are over the total", () => {
    expect(errorsFor(items({ a: "800", b: "300" })).own).toBe("That's ₱100.00 more than the total.");
  });

  it("refuses a person left with ₱0.00 when nothing is left over", () => {
    expect(errorsFor(items({ a: "500", b: "500" })).own).toBe(
      "Dana's share comes to ₱0.00. Untick Dana or add an amount.",
    );
    expect(errorsFor(items({ b: "500", c: "500" })).own).toBe(
      "Your share comes to ₱0.00. Untick yourself or add an amount.",
    );
  });

  // Owner decision B (2026-11-20): an uneven split never saves a ₱0.00 share, so a reopened
  // uneven cost always saves again unchanged.
  it("refuses a left-over too small to give everyone sharing it a piece", () => {
    // ₱1,000.01, you had ₱1,000.00: ₱0.01 left for 3 people, so two would get ₱0.00
    expect(errorsFor(items({ a: "1000" }, { amount: "1,000.01" })).own).toBe(
      "₱0.01 left over can't be shared by 3 people. Add it to someone's amount.",
    );
    expect(errorsFor(items({ a: "999.99" }, { amount: "1,000.01" })).own).toBe(
      "₱0.02 left over can't be shared by 3 people. Add it to someone's amount.",
    );
    // VND whole units: 2 dong for 3 people
    const vnd = { currency: "VND", spotIds: ["a", "b", "c"], names: context.names };
    expect(errorsFor(items({ b: "250,000" }, { amount: "250,002" }), vnd).own).toBe(
      "₫2 left over can't be shared by 3 people. Add it to someone's amount.",
    );
  });

  it("allows a small left-over when everyone without an amount still gets a piece", () => {
    // ₱0.02 left for 3 people: the payer (You) and Ben take a centavo each, Dana gets none of
    // the rest but keeps her own ₱0.50, so no one ends at ₱0.00.
    const v = valueFor(items({ a: "1000", c: "0.50" }, { amount: "1,000.52" }));
    expect(v.shares.map((s) => s.amount)).toEqual([100001, 1, 50]);
  });

  it("does not report own problems while the amount itself is wrong", () => {
    const e = errorsFor(items({ a: "9999" }, { amount: "" }));
    expect(e.amount).toBeDefined();
    expect(e.own).toBeUndefined();
  });
});

describe("splitOwnRule", () => {
  const names = { a: "You", b: "Ben", c: "Dana" };
  const rule = (total: number, own: { spotId: string; own: number }[], currency = "PHP") =>
    splitOwnRule({ total, sharedBy: ["a", "b", "c"], own, paidBy: "a", currency, names });

  it("gives the shares and what was left over", () => {
    expect(rule(10000, [{ spotId: "a", own: 4000 }])).toEqual({
      shares: [
        { spotId: "a", amount: 6000 },
        { spotId: "b", amount: 2000 },
        { spotId: "c", amount: 2000 },
      ],
      rest: 6000,
    });
  });

  it("refuses a left-over centavo that three people can't share", () => {
    expect(rule(1, [])).toEqual({
      error: "₱0.01 left over can't be shared by 3 people. Add it to someone's amount.",
    });
  });

  it("keeps the exact current messages for too much and a zero share", () => {
    expect(rule(1000, [{ spotId: "a", own: 1500 }])).toEqual({ error: "That's ₱5.00 more than the total." });
    expect(rule(1000, [{ spotId: "a", own: 500 }, { spotId: "b", own: 500 }])).toEqual({
      error: "Dana's share comes to ₱0.00. Untick Dana or add an amount.",
    });
  });
});

describe("cost categories", () => {
  it("lists the six categories in order, each with an icon", () => {
    expect(COST_CATEGORIES.map((c) => c.value)).toEqual([
      "food", "transport", "lodging", "activities", "shopping", "other",
    ]);
    expect(COST_CATEGORIES.map((c) => c.icon)).toEqual([
      "ForkKnife", "Car", "Bed", "Ticket", "ShoppingBag", "Receipt",
    ]);
  });

  it("knows the stored values, and shows Receipt for none", () => {
    expect(isCostCategory("food")).toBe(true);
    expect(isCostCategory("")).toBe(false);
    expect(isCostCategory("fun")).toBe(false);
    expect(costCategoryOf("lodging").label).toBe("Lodging");
    expect(costCategoryOf(null)).toMatchObject({ icon: "Receipt", label: "No category" });
    expect(costCategoryOf("gone")).toMatchObject({ icon: "Receipt" });
  });
});

describe("validateCostInput", () => {
  it("accepts good input, keeps accents, and works out the shares", () => {
    expect(validateCostInput(valid, context)).toEqual({
      ok: true,
      value: {
        description: "Dinner at Bún Chả",
        amount: 100000,
        paidBy: "a",
        category: "food",
        spentOn: "2027-03-12",
        shares: [
          { spotId: "a", amount: 33334, originalAmount: null },
          { spotId: "b", amount: 33333, originalAmount: null },
          { spotId: "c", amount: 33333, originalAmount: null },
        ],
        ownParts: null,
        money: { kind: "trip" },
      },
    });
  });

  it("tidies spaces in the description", () => {
    expect(valueFor({ description: "  Taxi   to  airport " }).description).toBe("Taxi to airport");
  });

  it("refuses a blank, invisible-looking or too long description", () => {
    expect(errorsFor({ description: "   " }).description).toBe("Please enter what it was.");
    expect(errorsFor({ description: "​​" }).description).toBe("Please enter what it was.");
    expect(errorsFor({ description: "x".repeat(81) }).description).toBe("Keep it to 80 characters or fewer.");
    expect(valueFor({ description: "x".repeat(80) }).description).toHaveLength(80);
  });

  it("gives the amount errors from the money module", () => {
    expect(errorsFor({ amount: "" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "0" }).amount).toBe("Enter an amount above zero.");
    expect(errorsFor({ amount: "1.005" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "250.5" }, { currency: "VND", spotIds: ["a"], names: { a: "You", b: "Ben", c: "Dana" } }).amount).toBe(
      "Enter an amount, like 1,250.",
    );
  });

  it("refuses a misplaced comma instead of saving a wrong amount", () => {
    expect(errorsFor({ amount: "12,50" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "1250,50" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "12,50" }, { currency: "VND", spotIds: ["a"], names: { a: "You", b: "Ben", c: "Dana" } }).amount).toBe(
      "Enter an amount, like 1,250.",
    );
    expect(valueFor({ amount: "1,250.5" }).amount).toBe(125050);
  });

  it("refuses a space inside the amount and a leading-zero comma group", () => {
    expect(errorsFor({ amount: "12 50" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "0,500" }).amount).toBe("Enter an amount, like 1,250.50.");
  });

  it("needs a payer who is in the trip", () => {
    expect(errorsFor({ paidBy: "" }).paidBy).toBe("Pick who paid.");
    expect(errorsFor({ paidBy: "stranger" }).paidBy).toBe("Pick who paid.");
  });

  it("puts the people in the trip's list order and ignores repeats", () => {
    const value = valueFor({ sharedBy: ["c", "a", "a"], paidBy: "b" });
    expect(value.shares.map((s) => s.spotId)).toEqual(["a", "c"]);
    expect(value.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(100000);
  });

  it("gives the payer the extra centavo only when the payer shares", () => {
    expect(valueFor({ paidBy: "c" }).shares.map((s) => s.amount)).toEqual([33333, 33333, 33334]);
    expect(valueFor({ paidBy: "a", sharedBy: ["b", "c"], amount: "1.01" }).shares.map((s) => s.amount)).toEqual([51, 50]);
  });

  it("needs at least one sharer and refuses anyone outside the trip", () => {
    expect(errorsFor({ sharedBy: [] }).sharedBy).toBe("Pick who shares it.");
    expect(errorsFor({ sharedBy: undefined }).sharedBy).toBe("Pick who shares it.");
    expect(errorsFor({ sharedBy: ["a", "stranger"] }).sharedBy).toBe("Pick who shares it.");
    expect(valueFor({ sharedBy: "b" }).shares).toEqual([{ spotId: "b", amount: 100000, originalAmount: null }]);
  });

  it("needs a real day between 2000 and 2100", () => {
    expect(errorsFor({ spentOn: "" }).spentOn).toBe("Pick a date.");
    expect(errorsFor({ spentOn: "2027-02-30" }).spentOn).toBe("Pick a date.");
    expect(errorsFor({ spentOn: "1999-12-31" }).spentOn).toBe("Pick a date.");
    expect(errorsFor({ spentOn: "2101-01-01" }).spentOn).toBe("Pick a date.");
    expect(valueFor({ spentOn: "2000-01-01" }).spentOn).toBe("2000-01-01");
    expect(valueFor({ spentOn: "2100-12-31" }).spentOn).toBe("2100-12-31");
  });

  it("allows no category, and refuses an unknown one", () => {
    expect(valueFor({ category: "" }).category).toBeNull();
    expect(errorsFor({ category: "fun" }).category).toBe("Pick a category from the list.");
  });

  it("reports every problem at once, and treats non-text values as empty", () => {
    const errors = errorsFor({ description: 5, amount: null, paidBy: {}, sharedBy: 7, spentOn: [], category: 1 });
    expect(Object.keys(errors).sort()).toEqual(["amount", "description", "paidBy", "sharedBy", "spentOn"]);
  });
});
