import type { CostListItem } from "@/lib/costs";
import type { PaymentListItem } from "@/lib/payments";

// "How your balance adds up": the viewer's own lines, built from the same cost and payment
// lists the balances are built from, so the total is their balance exactly. Pure: no database
// or framework imports (type-only imports above).

type Who = { name: string; isYou: boolean; hasLeft: boolean };

export type CostLine = {
  kind: "cost";
  costId: string;
  description: string;
  category: string | null;
  spentOn: string;
  amount: number;
  payer: Who;
  effect: number; // > 0 adds to what you are owed, < 0 to what you owe
};

export type PaymentLine = {
  kind: "payment";
  paymentId: string;
  from: Who;
  to: Who;
  method: PaymentListItem["method"];
  createdAt: Date;
  amount: number;
  effect: number; // sent: +amount (paid back), received: -amount (got back)
};

type CostInput = Pick<CostListItem, "id" | "description" | "category" | "spentOn" | "amount" | "currency" | "myShare"> & {
  payer: Pick<CostListItem["payer"], "name" | "isYou" | "hasLeft">;
};
type PaymentInput = Pick<PaymentListItem, "id" | "amount" | "method" | "createdAt"> & {
  from: Pick<PaymentListItem["from"], "name" | "isYou" | "hasLeft">;
  to: Pick<PaymentListItem["to"], "name" | "isYou" | "hasLeft">;
};

const who = ({ name, isYou, hasLeft }: Who): Who => ({ name, isYou, hasLeft });

// Costs in the trip's currency that the viewer paid or shares, and payments they sent or got,
// in the order given (newest first). A cost that adds nothing to their balance is left out.
// `total` is the sum of every effect and equals their `net` from getBalancesForMember.
export function balanceLinesOf(args: { currency: string; costs: CostInput[]; payments: PaymentInput[] }): {
  costs: CostLine[];
  payments: PaymentLine[];
  total: number;
} {
  const costs = args.costs
    .filter((item) => item.currency === args.currency && (item.payer.isYou || item.myShare !== null))
    .map((item): CostLine => ({
      kind: "cost",
      costId: item.id,
      description: item.description,
      category: item.category,
      spentOn: item.spentOn,
      amount: item.amount,
      payer: who(item.payer),
      effect: (item.payer.isYou ? item.amount : 0) - (item.myShare ?? 0),
    }))
    .filter((line) => line.effect !== 0);
  const payments = args.payments
    .filter((item) => item.from.isYou || item.to.isYou)
    .map((item): PaymentLine => ({
      kind: "payment",
      paymentId: item.id,
      from: who(item.from),
      to: who(item.to),
      method: item.method,
      createdAt: item.createdAt,
      amount: item.amount,
      effect: item.from.isYou ? item.amount : -item.amount,
    }));
  const total = [...costs, ...payments].reduce((sum, line) => sum + line.effect, 0);
  return { costs, payments, total };
}
