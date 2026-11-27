import { describe, expect, it } from "vitest";
import { balanceLinesOf } from "./balance-lines";
import { balancesOf, settleUp } from "./balances";

// The tester case with made-up names: Lunch 3,802.00 paid by Dan and Photoshoot 250.00 paid
// by Cara, each split four ways between Ana, Ben, Cara and Dan.
const LUNCH = 380200;
const SHOOT = 25000;
const LUNCH_SHARE = 95050;
const SHOOT_SHARE = 6250;

type Viewer = "Ana" | "Ben" | "Cara" | "Dan";
const person = (name: string, viewer: Viewer) => ({ name, isYou: name === viewer, hasLeft: false });

// What listCostsForMember gives each viewer, newest first.
function costsFor(viewer: Viewer) {
  return [
    { id: "shoot", description: "Photoshoot", category: "activities", spentOn: "2027-05-08", amount: SHOOT, currency: "PHP", payer: person("Cara", viewer), myShare: SHOOT_SHARE },
    { id: "lunch", description: "Lunch", category: "food", spentOn: "2027-05-07", amount: LUNCH, currency: "PHP", payer: person("Dan", viewer), myShare: LUNCH_SHARE },
  ];
}

const linesFor = (viewer: Viewer) => balanceLinesOf({ currency: "PHP", costs: costsFor(viewer), payments: [] });

describe("balanceLinesOf on the tester case", () => {
  it("shows Ana what she owes for each cost", () => {
    const result = linesFor("Ana");
    expect(result.costs.map((line) => [line.costId, line.effect])).toEqual([
      ["shoot", -SHOOT_SHARE],
      ["lunch", -LUNCH_SHARE],
    ]);
    expect(result.total).toBe(-101300);
  });

  it("shows Cara what she is owed for the cost she paid", () => {
    const result = linesFor("Cara");
    expect(result.costs.map((line) => [line.costId, line.effect])).toEqual([
      ["shoot", 18750],
      ["lunch", -LUNCH_SHARE],
    ]);
    expect(result.total).toBe(-76300);
  });

  it("shows Dan what he is owed", () => {
    const result = linesFor("Dan");
    expect(result.costs.map((line) => line.effect)).toEqual([-SHOOT_SHARE, LUNCH - LUNCH_SHARE]);
    expect(result.total).toBe(278900);
  });

  it("settles to exactly Ana, Ben and Cara paying Dan", () => {
    const nets = (["Ana", "Ben", "Cara", "Dan"] as const).map((spotId) => ({ spotId, net: linesFor(spotId).total }));
    expect(nets.map((n) => n.net)).toEqual([-101300, -101300, -76300, 278900]);
    expect(settleUp(balancesOf(nets.map((n) => ({ spotId: n.spotId, paid: Math.max(n.net, 0), share: Math.max(-n.net, 0), sent: 0, received: 0 }))))).toEqual([
      { from: "Ana", to: "Dan", amount: 101300 },
      { from: "Ben", to: "Dan", amount: 101300 },
      { from: "Cara", to: "Dan", amount: 76300 },
    ]);
  });
});

describe("balanceLinesOf edge cases", () => {
  const lunch = costsFor("Ana")[1]!;

  it("counts the full amount for a cost the viewer paid but is not in", () => {
    const result = balanceLinesOf({ currency: "PHP", costs: [{ ...lunch, payer: person("Ana", "Ana"), myShare: null }], payments: [] });
    expect(result.costs[0]!.effect).toBe(LUNCH);
    expect(result.total).toBe(LUNCH);
  });

  it("leaves out a cost that adds nothing", () => {
    const result = balanceLinesOf({ currency: "PHP", costs: [{ ...lunch, payer: person("Ana", "Ana"), myShare: LUNCH }], payments: [] });
    expect(result.costs).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("leaves out a cost the viewer is not in and did not pay", () => {
    expect(balanceLinesOf({ currency: "PHP", costs: [{ ...lunch, myShare: null }], payments: [] }).costs).toEqual([]);
  });

  it("leaves out a cost in another currency", () => {
    expect(balanceLinesOf({ currency: "PHP", costs: [{ ...lunch, currency: "VND" }], payments: [] }).total).toBe(0);
  });

  const sent = { id: "p1", amount: 50000, method: "gcash" as const, createdAt: new Date("2027-05-09T10:00:00Z"), from: person("Ana", "Ana"), to: person("Dan", "Ana") };

  it("counts a payment sent as paid back and one received as got back", () => {
    const result = balanceLinesOf({
      currency: "PHP",
      costs: costsFor("Ana"),
      payments: [sent, { ...sent, id: "p2", amount: 20000, from: person("Ben", "Ana"), to: person("Ana", "Ana") }],
    });
    expect(result.payments.map((line) => line.effect)).toEqual([50000, -20000]);
    expect(result.total).toBe(-101300 + 50000 - 20000);
  });

  it("leaves out a payment between two other people", () => {
    const other = { ...sent, from: person("Ben", "Ana"), to: person("Dan", "Ana") };
    expect(balanceLinesOf({ currency: "PHP", costs: [], payments: [other] }).payments).toEqual([]);
  });

  it("keeps the order it was given", () => {
    expect(linesFor("Ana").costs.map((line) => line.spentOn)).toEqual(["2027-05-08", "2027-05-07"]);
  });
});
