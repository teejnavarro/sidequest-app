import type { CostDetails } from "@/lib/costs";
import type { CostErrors, CostInput, CostRaw } from "@/lib/cost-input";
import { costCategoryOf } from "@/lib/cost-options";
import { formatMoney } from "@/lib/money";
import { dayLabel } from "@/lib/schedule-options";

// What the cost form remembers between tries, and the review shown before saving. Lives
// outside the "use server" file because such files may only export functions. Everything
// here is plain data and plain functions.

export type CostFormValues = CostRaw;

export const emptyCostValues: CostFormValues = {
  description: "",
  amount: "",
  paidBy: "",
  sharedBy: [],
  spentOn: "",
  category: "",
};

export type ReviewPerson = { spotId: string; name: string; isYou: boolean };

// One changed field on an edit. Amounts, people and the category are ready to show; the date
// is shown as "Sat, May 8". Old value first.
export type CostChange = {
  field: "amount" | "description" | "paidBy" | "spentOn" | "category";
  before: string;
  after: string;
};

// A person whose share changed on an edit. null means they were not in it (before) or are no
// longer in it (after).
export type ShareChange = { person: ReviewPerson; before: number | null; after: number | null };

export type CostReview = {
  kind: "new" | "edit";
  currency: string;
  description: string;
  amount: number;
  category: string | null;
  spentOn: string;
  payer: ReviewPerson;
  shares: (ReviewPerson & { amount: number })[];
  // Who got one more minor unit than the smallest share. Empty when it splits evenly.
  extraTakers: ReviewPerson[];
  // Edits only: what changed, and nothing for a new cost.
  changes: CostChange[];
  shareChanges: ShareChange[];
};

export type CostFormState = {
  errors: CostErrors & { form?: string };
  values: CostFormValues;
  // Set after Review: the page shows this instead of the form.
  review: CostReview | null;
  // "Someone just changed this cost. Check it again." after a stale save.
  notice: string | null;
  // The time the cost was last saved when the person opened it, as an ISO string. Empty for
  // a new cost. The save is refused if the cost has been saved since.
  updatedAt: string;
};

export const CHANGED_NOTICE = "Someone just changed this cost. Check it again.";

// The form values for a saved cost.
export function valuesFromCost(saved: CostDetails, amountText: string): CostFormValues {
  return {
    description: saved.description,
    amount: amountText,
    paidBy: saved.paidBy,
    sharedBy: saved.shares.map((share) => share.spotId),
    spentOn: saved.spentOn,
    category: saved.category ?? "",
  };
}

// Works out the review for a checked cost. `people` is every spot in the trip, so each id has
// a name. For an edit, `before` is the cost as it is saved now.
export function buildCostReview(options: {
  currency: string;
  input: CostInput;
  people: ReviewPerson[];
  before: CostDetails | null;
}): CostReview {
  const { currency, input, people, before } = options;
  const person = (spotId: string): ReviewPerson =>
    people.find((p) => p.spotId === spotId) ?? { spotId, name: "Someone", isYou: false };

  const shares = input.shares.map((share) => ({ ...person(share.spotId), amount: share.amount }));
  const smallest = Math.min(...shares.map((share) => share.amount));
  const extraTakers = shares
    .filter((share) => share.amount > smallest)
    .map(({ spotId, name, isYou }) => ({ spotId, name, isYou }));

  const changes: CostChange[] = [];
  const shareChanges: ShareChange[] = [];
  if (before) {
    const note = (field: CostChange["field"], was: string, now: string) => {
      if (was !== now) changes.push({ field, before: was, after: now });
    };
    note("amount", formatMoney(before.amount, currency), formatMoney(input.amount, currency));
    note("description", before.description, input.description);
    note("paidBy", person(before.paidBy).name, person(input.paidBy).name);
    note("spentOn", dayLabel(before.spentOn), dayLabel(input.spentOn));
    note("category", costCategoryOf(before.category).label, costCategoryOf(input.category).label);

    const was = new Map(before.shares.map((share) => [share.spotId, share.amount]));
    const now = new Map(input.shares.map((share) => [share.spotId, share.amount]));
    for (const { spotId } of people) {
      const [oldShare, newShare] = [was.get(spotId) ?? null, now.get(spotId) ?? null];
      if (oldShare !== newShare) shareChanges.push({ person: person(spotId), before: oldShare, after: newShare });
    }
  }

  return {
    kind: before ? "edit" : "new",
    currency,
    description: input.description,
    amount: input.amount,
    category: input.category,
    spentOn: input.spentOn,
    payer: person(input.paidBy),
    shares,
    extraTakers,
    changes,
    shareChanges,
  };
}

export type DeleteCostState = { error?: string };
