import { describe, expect, it } from "vitest";
import { COST_CATEGORIES, costCategoryOf, isCostCategory } from "./cost-options";
import { validateCostInput } from "./cost-input";

const context = { currency: "PHP", spotIds: ["a", "b", "c"] };

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
          { spotId: "a", amount: 33334 },
          { spotId: "b", amount: 33333 },
          { spotId: "c", amount: 33333 },
        ],
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
    expect(errorsFor({ amount: "250.5" }, { currency: "VND", spotIds: ["a"] }).amount).toBe(
      "Enter an amount, like 1,250.",
    );
  });

  it("refuses a misplaced comma instead of saving a wrong amount", () => {
    expect(errorsFor({ amount: "12,50" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "1250,50" }).amount).toBe("Enter an amount, like 1,250.50.");
    expect(errorsFor({ amount: "12,50" }, { currency: "VND", spotIds: ["a"] }).amount).toBe(
      "Enter an amount, like 1,250.",
    );
    expect(valueFor({ amount: "1,250.5" }).amount).toBe(125050);
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
    expect(valueFor({ sharedBy: "b" }).shares).toEqual([{ spotId: "b", amount: 100000 }]);
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
