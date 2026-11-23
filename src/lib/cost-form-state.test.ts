import { describe, expect, it } from "vitest";
import type { CostDetails } from "./costs";
import { buildCostReview, defaultCostValues, valuesFromCost } from "./cost-form-state";
import { validateCostInput } from "./cost-input";

const people = [
  { spotId: "a", name: "Maya", isYou: true },
  { spotId: "b", name: "Ben", isYou: false },
  { spotId: "c", name: "Dana", isYou: false },
];
const context = { currency: "PHP", spotIds: ["a", "b", "c"], names: { a: "You", b: "Ben", c: "Dana" } };

function checked(overrides: Record<string, unknown> = {}) {
  const result = validateCostInput(
    { description: "Dinner", amount: "1000", paidBy: "a", sharedBy: ["a", "b", "c"], spentOn: "2027-03-12", category: "food", ...overrides },
    context,
  );
  if (!result.ok) throw new Error("expected ok");
  return result.value;
}

const saved: CostDetails = {
  id: "c1",
  description: "Dinner",
  amount: 100000,
  currency: "PHP",
  category: "food",
  spentOn: "2027-03-12",
  paidBy: "a",
  original: null,
  shares: [
    { spotId: "a", amount: 33334, originalAmount: null },
    { spotId: "b", amount: 33333, originalAmount: null },
    { spotId: "c", amount: 33333, originalAmount: null },
  ],
  updatedAt: new Date("2027-03-12T10:00:00.000Z"),
};

describe("buildCostReview for a new cost", () => {
  it("names the payer and each share, with no changes", () => {
    const review = buildCostReview({ currency: "PHP", input: checked(), people, before: null });
    expect(review).toMatchObject({
      kind: "new",
      amount: 100000,
      payer: { name: "Maya", isYou: true },
      changes: [],
      shareChanges: [],
    });
    expect(review.shares.map((s) => [s.name, s.amount])).toEqual([["Maya", 33334], ["Ben", 33333], ["Dana", 33333]]);
  });

  it("names who takes the extra unit when it does not split evenly, and no one when it does", () => {
    const uneven = buildCostReview({ currency: "PHP", input: checked(), people, before: null });
    expect(uneven.extraTakers.map((p) => p.name)).toEqual(["Maya"]);
    const several = buildCostReview({ currency: "PHP", input: checked({ amount: "0.05", paidBy: "b" }), people, before: null });
    expect(several.extraTakers.map((p) => p.name)).toEqual(["Maya", "Ben"]);
    const even = buildCostReview({ currency: "PHP", input: checked({ amount: "900" }), people, before: null });
    expect(even.extraTakers).toEqual([]);
  });

  it("shows what each person had on an uneven split, and the extra unit comes from the equal part only", () => {
    const uneven = checked({ amount: "1000.01", paidBy: "b", split: "items", own: { a: "700" } });
    const review = buildCostReview({ currency: "PHP", input: uneven, people, before: null });
    expect(review.uneven).toBe(true);
    expect(review.shares.map((s) => s.own)).toEqual([70000, 0, 0]);
    expect(review.rest).toBe(30001);
    // equal parts 10001 (Ben, payer), 10000, 10000: only Ben holds the extra unit
    expect(review.extraTakers.map((p) => p.name)).toEqual(["Ben"]);
    expect(buildCostReview({ currency: "PHP", input: checked(), people, before: null })).toMatchObject({
      uneven: false,
      rest: 100000,
    });
  });

  it("falls back to Someone for a spot it does not know", () => {
    const review = buildCostReview({ currency: "PHP", input: checked(), people: [], before: null });
    expect(review.payer.name).toBe("Someone");
  });
});

describe("buildCostReview for an edit", () => {
  const review = (overrides: Record<string, unknown>) =>
    buildCostReview({ currency: "PHP", input: checked(overrides), people, before: saved });

  it("lists nothing when nothing changed", () => {
    const same = review({});
    expect(same.kind).toBe("edit");
    expect(same.changes).toEqual([]);
    expect(same.shareChanges).toEqual([]);
  });

  it("lists only the fields that changed, old value first", () => {
    const changed = review({ amount: "3500", description: "Dinner and drinks", category: "", spentOn: "2027-03-13", paidBy: "b" });
    expect(changed.changes).toEqual([
      { field: "amount", before: "₱1,000.00", after: "₱3,500.00" },
      { field: "description", before: "Dinner", after: "Dinner and drinks" },
      { field: "paidBy", before: "Maya", after: "Ben" },
      { field: "spentOn", before: "Fri, Mar 12", after: "Sat, Mar 13" },
      { field: "category", before: "Food", after: "No category" },
    ]);
  });

  it("lists each person whose share changed, including people added or taken out", () => {
    const changed = review({ amount: "900", sharedBy: ["a", "b"] });
    expect(changed.shareChanges).toEqual([
      { person: people[0], before: 33334, after: 45000 },
      { person: people[1], before: 33333, after: 45000 },
      { person: people[2], before: 33333, after: null },
    ]);
    const added = buildCostReview({
      currency: "PHP",
      input: checked({ amount: "1000", sharedBy: ["a", "b"], paidBy: "a" }),
      people,
      before: { ...saved, shares: [{ spotId: "a", amount: 100000, originalAmount: null }] },
    });
    expect(added.shareChanges.map((c) => [c.person.name, c.before, c.after])).toEqual([
      ["Maya", 100000, 50000],
      ["Ben", null, 50000],
    ]);
  });
});

describe("valuesFromCost", () => {
  it("turns a saved cost back into form values", () => {
    expect(valuesFromCost(saved, "1000.00")).toEqual({
      description: "Dinner",
      amount: "1000.00",
      paidBy: "a",
      sharedBy: ["a", "b", "c"],
      spentOn: "2027-03-12",
      category: "food",
      split: "equal",
      own: {},
      currency: "",
      fx: "rate",
      rate: "",
      charged: "",
    });
    expect(valuesFromCost({ ...saved, category: null }, "1").category).toBe("");
  });

  it("reopens an uneven cost as items with every person's full share", () => {
    const uneven = {
      ...saved,
      amount: 186000,
      paidBy: "b",
      shares: [
        { spotId: "a", amount: 98666, originalAmount: null },
        { spotId: "b", amount: 28667, originalAmount: null },
        { spotId: "c", amount: 58667, originalAmount: null },
      ],
    };
    const values = valuesFromCost(uneven, "1860.00");
    expect(values.split).toBe("items");
    expect(values.own).toEqual({ a: "986.66", b: "286.67", c: "586.67" });
  });

  it("saves an unchanged uneven cost again with the same shares", () => {
    const uneven = {
      ...saved,
      amount: 186000,
      paidBy: "b",
      shares: [
        { spotId: "a", amount: 79000, originalAmount: null },
        { spotId: "b", amount: 9000, originalAmount: null },
        { spotId: "c", amount: 98000, originalAmount: null },
      ],
    };
    const values = valuesFromCost(uneven, "1860.00");
    const again = validateCostInput(values, context);
    if (!again.ok) throw new Error(JSON.stringify(again.errors));
    expect(again.value.shares).toEqual(uneven.shares);
  });
});

describe("defaultCostValues", () => {
  const crew = [
    { spotId: "a", userId: "u1", name: "Maya", image: null, isGuest: false, isYou: false, hasLeft: false },
    { spotId: "b", userId: "u2", name: "Ben", image: null, isGuest: false, isYou: true, hasLeft: false },
    { spotId: "g", userId: "g", name: "Dana", image: null, isGuest: true, isYou: false, hasLeft: false },
  ];

  it("is paid by you, shared by everyone, with nothing else filled in", () => {
    expect(defaultCostValues({ people: crew, today: "2027-05-09", tripStart: "2027-05-08" })).toEqual({
      description: "",
      amount: "",
      paidBy: "b",
      sharedBy: ["a", "b", "g"],
      spentOn: "2027-05-09",
      category: "",
      split: "equal",
      own: {},
      currency: "",
      fx: "rate",
      rate: "",
      charged: "",
    });
  });

  it("uses the first day while the trip has not started, and today from then on", () => {
    expect(defaultCostValues({ people: crew, today: "2027-01-01", tripStart: "2027-05-08" }).spentOn).toBe("2027-05-08");
    expect(defaultCostValues({ people: crew, today: "2027-05-08", tripStart: "2027-05-08" }).spentOn).toBe("2027-05-08");
  });
});
