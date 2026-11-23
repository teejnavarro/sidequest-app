import type { CostDetails } from "@/lib/costs";
import type { CostErrors, CostInput, CostRaw } from "@/lib/cost-input";
import { costCategoryOf } from "@/lib/cost-options";
import { firstNameOf } from "@/lib/display-name";
import { amountText, formatMoney, splitEqually } from "@/lib/money";
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
  split: "equal",
  own: {},
  currency: "",
  fx: "rate",
  rate: "",
  charged: "",
};

// A person (or guest) the cost can be paid by or shared with. `userId` only colors the face.
export type CostPerson = {
  spotId: string;
  userId: string;
  name: string; // first name
  image: string | null;
  isGuest: boolean;
  isYou: boolean;
  // Left the trip: only offered on a cost they are already in.
  hasLeft: boolean;
};

// The trip's people as the cost form lists them, in the trip's list order. A person's `id` is
// their user id, which is how "you" is found; a guest's is their spot id.
export function costPeople(
  members: {
    id: string;
    spotId: string;
    name: string;
    image: string | null;
    isGuest: boolean;
    hasLeft: boolean;
  }[],
  userId: string,
): CostPerson[] {
  return members.map((member) => ({
    spotId: member.spotId,
    userId: member.id,
    name: firstNameOf(member.name),
    image: member.image,
    isGuest: member.isGuest,
    isYou: member.id === userId,
    hasLeft: member.hasLeft,
  }));
}

// What a new cost starts as: paid by you, split between everyone, dated today in the trip's
// time zone, or the trip's first day while the trip hasn't started.
export function defaultCostValues(options: {
  people: CostPerson[];
  today: string;
  tripStart: string;
}): CostFormValues {
  const { people, today, tripStart } = options;
  return {
    ...emptyCostValues,
    paidBy: people.find((person) => person.isYou)?.spotId ?? "",
    sharedBy: people.map((person) => person.spotId),
    spentOn: today < tripStart ? tripStart : today,
  };
}

export type ReviewPerson ={ spotId: string; name: string; isYou: boolean };

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
  // `own` is what the person had on an uneven split, null on an equal one.
  shares: (ReviewPerson & { amount: number; own: number | null })[];
  // True when the cost was split by what each person had.
  uneven: boolean;
  // What was left to share equally after the own amounts (the whole amount when equal).
  rest: number;
  // Who got one more minor unit than the smallest equal part. Empty when it divides evenly.
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

// The form values for a saved cost. An equal split opens as equal; anything else opens as an
// uneven split with every person's full share in their box and nothing left over.
export function valuesFromCost(saved: CostDetails, amountText_: string): CostFormValues {
  const spotIds = saved.shares.map((share) => share.spotId);
  const equal = splitEqually(saved.amount, spotIds, saved.paidBy);
  const isEqual = equal.every((share, index) => share.amount === saved.shares[index]?.amount);
  return {
    description: saved.description,
    amount: amountText_,
    paidBy: saved.paidBy,
    sharedBy: spotIds,
    spentOn: saved.spentOn,
    category: saved.category ?? "",
    split: isEqual ? "equal" : "items",
    own: isEqual
      ? {}
      : Object.fromEntries(saved.shares.map((share) => [share.spotId, amountText(share.amount, saved.currency)])),
    currency: "",
    fx: "rate",
    rate: "",
    charged: "",
  };
}

// Works out the review for a checked cost. `people` is every spot in the trip, so each id has
// a name. For an edit, `before` is the cost as it is saved now.
export function buildCostReview(options: {
  currency: string;
  // `ownParts` is what each person had on an uneven split (from validateCostInput), else null.
  input: CostInput & { ownParts: Record<string, number> | null };
  people: ReviewPerson[];
  before: CostDetails | null;
}): CostReview {
  const { currency, input, people, before } = options;
  const { ownParts } = input;
  const person = (spotId: string): ReviewPerson =>
    people.find((p) => p.spotId === spotId) ?? { spotId, name: "Someone", isYou: false };

  const shares = input.shares.map((share) => ({
    ...person(share.spotId),
    amount: share.amount,
    own: ownParts === null ? null : (ownParts[share.spotId] ?? 0),
  }));
  // The extra minor unit lives in the equal part only, so take the own amounts out first.
  const equalPart = (share: (typeof shares)[number]) => share.amount - (share.own ?? 0);
  const smallest = Math.min(...shares.map(equalPart));
  const rest = shares.reduce((sum, share) => sum + equalPart(share), 0);
  const extraTakers = shares
    .filter((share) => equalPart(share) > smallest)
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
    uneven: ownParts !== null,
    rest,
    extraTakers,
    changes,
    shareChanges,
  };
}

export type DeleteCostState = { error?: string };
