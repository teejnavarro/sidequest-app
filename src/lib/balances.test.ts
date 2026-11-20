import { describe, expect, it } from "vitest";
import { type Balance, type Payment, balancesOf, settleUp } from "./balances";

const net = (spotId: string, n: number): Balance => ({ spotId, net: n });

// Applies the payments to the balances and returns what each person is left with.
function apply(balances: Balance[], payments: Payment[]): Record<string, number> {
  const left = Object.fromEntries(balances.map((b) => [b.spotId, b.net]));
  for (const p of payments) {
    left[p.from] = left[p.from]! + p.amount;
    left[p.to] = left[p.to]! - p.amount;
  }
  return left;
}

describe("balancesOf", () => {
  it("is paid minus share, in input order", () => {
    expect(
      balancesOf([
        { spotId: "a", paid: 500, share: 200 },
        { spotId: "b", paid: 0, share: 300 },
      ]),
    ).toEqual([net("a", 300), net("b", -300)]);
  });

  it("matches the hand-worked example (4 people, 6 costs)", () => {
    const totals = [
      { spotId: "maya", paid: 600000, share: 322333 },
      { spotId: "bea", paid: 244000, share: 354333 },
      { spotId: "jun", paid: 362000, share: 321000 },
      { spotId: "dana", paid: 100000, share: 308334 },
    ];
    const balances = balancesOf(totals);
    expect(balances.map((b) => b.net)).toEqual([277667, -110333, 41000, -208334]);
    expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
    expect(settleUp(balances)).toEqual([
      { from: "bea", to: "maya", amount: 69333 },
      { from: "bea", to: "jun", amount: 41000 },
      { from: "dana", to: "maya", amount: 208334 },
    ]);
  });
});

describe("settleUp", () => {
  it("is empty when everyone is even", () => {
    expect(settleUp([])).toEqual([]);
    expect(settleUp([net("a", 0), net("b", 0)])).toEqual([]);
  });

  it("is one payment for two people", () => {
    expect(settleUp([net("a", 500), net("b", -500)])).toEqual([{ from: "b", to: "a", amount: 500 }]);
  });

  it("beats the simple method when groups cancel out", () => {
    const balances = [
      net("ana", 40000),
      net("ben", 30000),
      net("cara", -30000),
      net("dio", -25000),
      net("eli", -15000),
    ];
    expect(settleUp(balances)).toEqual([
      { from: "cara", to: "ben", amount: 30000 },
      { from: "dio", to: "ana", amount: 25000 },
      { from: "eli", to: "ana", amount: 15000 },
    ]);
  });

  it("throws when the balances do not add up to zero", () => {
    expect(() => settleUp([net("a", 100), net("b", -99)])).toThrow();
  });

  it("settles 13 people with the simple method", () => {
    const balances = Array.from({ length: 13 }, (_, i) => net(`p${i}`, i === 12 ? -78 : i + 1));
    const payments = settleUp(balances);
    expect(Object.values(apply(balances, payments)).every((v) => v === 0)).toBe(true);
    expect(payments.length).toBeLessThanOrEqual(12);
  });

  it("settles a seeded random sweep with positive whole payments and at most n-1", () => {
    let seed = 12345;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let run = 0; run < 600; run++) {
      const people = 2 + random(9);
      const nets = Array.from({ length: people }, () => random(2001) - 1000);
      // Zero the sum by adjusting the last person; some runs add zero-sum pairs on purpose.
      nets[people - 1] = nets[people - 1]! - nets.reduce((s, v) => s + v, 0);
      const balances = nets.map((n, i) => net(`p${i}`, n));
      const payments = settleUp(balances);
      expect(Object.values(apply(balances, payments)).every((v) => v === 0)).toBe(true);
      for (const p of payments) {
        expect(Number.isInteger(p.amount) && p.amount > 0).toBe(true);
        expect(p.from).not.toBe(p.to);
      }
      expect(payments.length).toBeLessThanOrEqual(Math.max(0, nets.filter((v) => v !== 0).length - 1));
    }
  });
});
