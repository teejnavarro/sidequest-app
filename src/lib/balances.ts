// Who owes whom. Balances are never stored: each visit adds up what every spot paid and its
// share of every cost, and these pure functions turn that into balances and the fewest
// payments. Whole minor units only, no floating point, no database or framework imports.

export type SpotTotals = { spotId: string; paid: number; share: number }; // minor units
export type Balance = { spotId: string; net: number }; // paid - share; > 0 owed, < 0 owes
export type Payment = { from: string; to: string; amount: number }; // spot ids, amount > 0

// Above this many people with a non-zero balance the exact search (2^n) is skipped.
const EXACT_LIMIT = 12;

export function balancesOf(totals: SpotTotals[]): Balance[] {
  return totals.map(({ spotId, paid, share }) => ({ spotId, net: paid - share }));
}

// The person who owes most pays the person owed most, the smaller of the two amounts, until
// everyone is even. Ties go to whoever comes first in `people`.
function settleSimply(people: { index: number; spotId: string; net: number }[]): Payment[] {
  const left = people.map((p) => ({ ...p }));
  const payments: Payment[] = [];
  for (;;) {
    let debtor: (typeof left)[number] | undefined;
    let creditor: (typeof left)[number] | undefined;
    for (const p of left) {
      if (p.net < 0 && (!debtor || p.net < debtor.net)) debtor = p;
      if (p.net > 0 && (!creditor || p.net > creditor.net)) creditor = p;
    }
    if (!debtor || !creditor) break;
    const amount = Math.min(-debtor.net, creditor.net);
    debtor.net += amount;
    creditor.net -= amount;
    payments.push({ from: debtor.spotId, to: creditor.spotId, amount });
  }
  return payments;
}

// The fewest payments that make everyone even. Finds the most groups of people whose
// balances cancel out among themselves (n - groups payments is the minimum), then settles
// each group simply. Throws if the balances don't add up to zero (a bug, never expected).
export function settleUp(balances: Balance[]): Payment[] {
  if (balances.reduce((sum, b) => sum + b.net, 0) !== 0) {
    throw new Error("Balances do not add up to zero.");
  }
  const people = balances
    .map((b, index) => ({ index, spotId: b.spotId, net: b.net }))
    .filter((p) => p.net !== 0);
  const n = people.length;
  if (n === 0) return [];

  let payments: (Payment & { fromIndex: number; toIndex: number })[];
  const order = new Map(people.map((p) => [p.spotId, p.index]));
  const toResult = (list: Payment[]) =>
    list.map((p) => ({ ...p, fromIndex: order.get(p.from) ?? 0, toIndex: order.get(p.to) ?? 0 }));

  if (n > EXACT_LIMIT) {
    payments = toResult(settleSimply(people));
  } else {
    // sum[mask] is the total of the people in the mask; best[mask] the most zero-sum groups
    // the mask can be cut into, reached by adding one person at a time (from[mask]).
    const size = 1 << n;
    const sum = new Array<number>(size).fill(0);
    const best = new Array<number>(size).fill(0);
    const from = new Array<number>(size).fill(-1);
    for (let mask = 1; mask < size; mask++) {
      const low = 31 - Math.clz32(mask & -mask);
      sum[mask] = sum[mask & (mask - 1)]! + people[low]!.net;
      let most = -1;
      for (let i = 0; i < n; i++) {
        if (!(mask & (1 << i)) || best[mask ^ (1 << i)]! <= most) continue;
        most = best[mask ^ (1 << i)]!;
        from[mask] = i;
      }
      best[mask] = most + (sum[mask] === 0 ? 1 : 0);
    }
    // Walk back from everyone: the order people were added in, cut where a prefix sums to 0.
    const added: number[] = [];
    for (let mask = size - 1; mask > 0; mask ^= 1 << from[mask]!) added.push(from[mask]!);
    added.reverse();
    payments = [];
    let group: typeof people = [];
    let running = 0;
    for (const i of added) {
      group.push(people[i]!);
      running += people[i]!.net;
      if (running === 0) {
        group.sort((a, b) => a.index - b.index);
        payments.push(...toResult(settleSimply(group)));
        group = [];
      }
    }
  }
  return payments
    .sort((a, b) => a.fromIndex - b.fromIndex || a.toIndex - b.toIndex)
    .map(({ from, to, amount }) => ({ from, to, amount }));
}
