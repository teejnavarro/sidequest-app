import { describe, expect, it } from "vitest";
import { type Balance, type Payment, balancesOf, settleUp } from "./balances";
import type { CostDetails } from "./costs";
import { valuesFromCost } from "./cost-form-state";
import { validateCostInput } from "./cost-input";
import { amountText } from "./money";

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

// The fewest payments, worked out a different way: settle the first open person against
// every possible partner and keep the shortest. Slow, so only for a few people.
function fewestByTrying(nets: number[]): number {
  const d = nets.filter((v) => v !== 0);
  const search = (start: number): number => {
    while (start < d.length && d[start] === 0) start++;
    if (start === d.length) return 0;
    let fewest = Infinity;
    for (let j = start + 1; j < d.length; j++) {
      if (d[j]! * d[start]! >= 0) continue;
      d[j]! += d[start]!;
      fewest = Math.min(fewest, 1 + search(start + 1));
      d[j]! -= d[start]!;
    }
    return fewest;
  };
  return search(0);
}

function seeded(start: number) {
  let seed = start;
  return (max: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % max;
  };
}

describe("settleUp gives the fewest payments", () => {
  it("matches a slow search on random trips of up to 8 people, with many groups that cancel out", () => {
    const random = seeded(2026);
    for (let run = 0; run < 400; run++) {
      const people = 2 + random(7);
      // Few distinct values, so groups that cancel out among themselves are common.
      const nets = Array.from({ length: people }, () => (random(7) - 3) * 100);
      nets[people - 1] = nets[people - 1]! - nets.reduce((s, v) => s + v, 0);
      const balances = nets.map((n, i) => net(`p${i}`, n));
      const payments = settleUp(balances);
      expect(Object.values(apply(balances, payments)).every((v) => v === 0)).toBe(true);
      expect(payments.length).toBe(fewestByTrying(nets));
    }
  });

  it("still finds the fewest at 12 people with a balance (the most the exact search takes)", () => {
    // Two "exact beats simple" groups (3 payments each, 4 by the simple method) and one pair.
    const group = (scale: number, tag: string) =>
      [40000, 30000, -30000, -25000, -15000].map((v, i) => net(`${tag}${i}`, v * scale));
    const balances = [...group(1, "x"), ...group(7, "y"), net("p", 1001), net("q", -1001)];
    const payments = settleUp(balances);
    expect(Object.values(apply(balances, payments)).every((v) => v === 0)).toBe(true);
    expect(payments).toHaveLength(7);
  });
});

describe("whole trips through the cost checks", () => {
  it("keeps every cost adding up, balances at zero, and uneven costs saving again unchanged", () => {
    const random = seeded(777);
    for (let run = 0; run < 300; run++) {
      const currency = random(2) === 0 ? "PHP" : "VND";
      const spotIds = Array.from({ length: 2 + random(9) }, (_, i) => `s${i}`);
      const names = Object.fromEntries(spotIds.map((id, i) => [id, i === 0 ? "You" : `P${i}`]));
      const context = { currency, spotIds, names };
      const paid = new Map(spotIds.map((id) => [id, 0]));
      const share = new Map(spotIds.map((id) => [id, 0]));

      for (let c = 0; c < 1 + random(8); c++) {
        const amount = 100 + random(500000);
        const sharedBy = spotIds.filter(() => random(3) > 0);
        if (sharedBy.length === 0) sharedBy.push(spotIds[0]!);
        const paidBy = spotIds[random(spotIds.length)]!;
        const uneven = random(2) === 0;
        // Own amounts for some sharers, together never more than the cost.
        const own: Record<string, string> = {};
        let room = amount;
        // Sometimes leave only a few minor units over, fewer than the people sharing them.
        if (uneven && random(3) === 0) {
          const mine = amount - random(sharedBy.length + 1);
          room -= mine;
          own[sharedBy[0]!] = amountText(mine, currency);
        }
        for (const id of sharedBy) {
          if (own[id] !== undefined) continue;
          if (!uneven || random(2) === 0 || room === 0) continue;
          const mine = 1 + random(room);
          room -= mine;
          own[id] = amountText(mine, currency);
        }
        const raw = {
          description: "Cost",
          amount: amountText(amount, currency),
          paidBy,
          sharedBy,
          spentOn: "2027-05-09",
          category: "",
          split: uneven ? "items" : "equal",
          own,
        };
        const result = validateCostInput(raw, context);
        if (!result.ok) {
          // Only an uneven split may be refused, and only for its own amounts.
          expect(uneven).toBe(true);
          expect(Object.keys(result.errors)).toEqual(["own"]);
          continue;
        }
        const { shares } = result.value;
        expect(shares.reduce((s, x) => s + x.amount, 0)).toBe(amount);
        expect(shares.map((s) => s.spotId)).toEqual(sharedBy);
        if (uneven) {
          expect(shares.every((s) => s.amount > 0)).toBe(true);
          // Reopen it as Edit cost does and save it unchanged: the same shares come back.
          const saved: CostDetails = {
            id: "c",
            description: "Cost",
            amount,
            currency,
            category: null,
            spentOn: "2027-05-09",
            paidBy,
            original: null,
            shares,
            updatedAt: new Date(0),
          };
          const again = validateCostInput(valuesFromCost(saved), context);
          if (!again.ok) throw new Error(`reopened cost refused: ${JSON.stringify(again.errors)}`);
          expect(again.value.shares).toEqual(shares);
        }
        paid.set(paidBy, paid.get(paidBy)! + amount);
        for (const s of shares) share.set(s.spotId, share.get(s.spotId)! + s.amount);
      }

      const balances = balancesOf(spotIds.map((id) => ({ spotId: id, paid: paid.get(id)!, share: share.get(id)! })));
      expect(balances.reduce((s, b) => s + b.net, 0)).toBe(0);
      const payments = settleUp(balances);
      expect(Object.values(apply(balances, payments)).every((v) => v === 0)).toBe(true);
      expect(payments.every((p) => Number.isInteger(p.amount) && p.amount > 0)).toBe(true);
      expect(payments.length).toBeLessThanOrEqual(Math.max(0, balances.filter((b) => b.net !== 0).length - 1));
    }
  });
});
