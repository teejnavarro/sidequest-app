import type { CostDetails } from "@/lib/costs";
import type { CostErrors, CostInput, CostRaw } from "@/lib/cost-input";
import { costCategoryOf } from "@/lib/cost-options";
import { firstNameOf } from "@/lib/display-name";
import { amountText, effectiveRateText, formatMoney, rateText, splitEqually } from "@/lib/money";
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
// time zone, or the trip's first day while the trip hasn't started, in the currency you used
// last with the latest rate for it (`defaults`, from getNewCostDefaults).
export function defaultCostValues(options: {
  people: CostPerson[];
  today: string;
  tripStart: string;
  defaults: { currency: string; rate: string };
}): CostFormValues {
  const { people, today, tripStart, defaults } = options;
  return {
    ...emptyCostValues,
    currency: defaults.currency,
    rate: defaults.rate,
    paidBy: people.find((person) => person.isYou)?.spotId ?? "",
    sharedBy: people.map((person) => person.spotId),
    spentOn: today < tripStart ? tripStart : today,
  };
}

export type ReviewPerson ={ spotId: string; name: string; isYou: boolean };

// One changed field on an edit. Amounts, people and the category are ready to show; the date
// is shown as "Sat, May 8". Old value first.
export type CostChange = {
  field: "amount" | "main" | "rate" | "description" | "paidBy" | "spentOn" | "category" | "photo";
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
  // A cost in another currency: what was typed, the rate (null when the card amount was typed)
  // and the rate the amounts work out to ("431.70"). Null for a cost in the trip's currency.
  original: { currency: string; amount: number; rate: string | null; effectiveRate: string } | null;
  category: string | null;
  spentOn: string;
  payer: ReviewPerson;
  // `own` is what the person had on an uneven split, null on an equal one. For a cost in
  // another currency both are in that currency, and `originalAmount` is the share in it.
  shares: (ReviewPerson & { amount: number; originalAmount: number | null; own: number | null })[];
  // True when the cost was split by what each person had.
  uneven: boolean;
  // A new cost that is saved with a receipt photo (always false for an edit: see `changes`).
  withPhoto: boolean;
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

// True when the shares are what an equal split gives (on the original shares for a foreign cost).
export function isEvenSplit(saved: Pick<CostDetails, "amount" | "paidBy" | "original" | "shares">): boolean {
  const { original } = saved;
  const unit = original ?? { amount: saved.amount };
  const part = (share: CostDetails["shares"][number]) => (original ? (share.originalAmount ?? 0) : share.amount);
  const equal = splitEqually(unit.amount, saved.shares.map((share) => share.spotId), saved.paidBy);
  return equal.every((share, index) => share.amount === part(saved.shares[index]!));
}

// The form values for a saved cost. An equal split opens as equal; anything else opens as an
// uneven split with every person's full share in their box and nothing left over. A cost in
// another currency opens in that currency, with its original amounts and rate (or the card
// amount), and is checked for equal on the original shares.
export function valuesFromCost(saved: CostDetails): CostFormValues {
  const spotIds = saved.shares.map((share) => share.spotId);
  const { original } = saved;
  const unit = original ?? { amount: saved.amount, currency: saved.currency, rate: null };
  const part = (share: CostDetails["shares"][number]) => (original ? (share.originalAmount ?? 0) : share.amount);
  const isEqual = isEvenSplit(saved);
  return {
    description: saved.description,
    amount: amountText(unit.amount, unit.currency),
    paidBy: saved.paidBy,
    sharedBy: spotIds,
    spentOn: saved.spentOn,
    category: saved.category ?? "",
    split: isEqual ? "equal" : "items",
    own: isEqual
      ? {}
      : Object.fromEntries(saved.shares.map((share) => [share.spotId, amountText(part(share), unit.currency)])),
    currency: original ? original.currency : "",
    fx: original && original.rate === null ? "charged" : "rate",
    rate: original?.rate ?? "",
    charged: original ? amountText(saved.amount, saved.currency) : "",
  };
}

// What the form says to do with the receipt photo: keep what is saved, put the picked file in
// its place, or take it off.
export type PhotoAction = "keep" | "replace" | "remove";

export function photoActionOf(value: string): PhotoAction {
  return value === "replace" || value === "remove" ? value : "keep";
}

// Works out the review for a checked cost. `people` is every spot in the trip, so each id has
// a name. For an edit, `before` is the cost as it is saved now.
export function buildCostReview(options: {
  currency: string;
  // `ownParts` is what each person had on an uneven split (from validateCostInput), else null.
  input: CostInput & { ownParts: Record<string, number> | null };
  people: ReviewPerson[];
  before: CostDetails | null;
  photo?: PhotoAction;
}): CostReview {
  const { currency, input, people, before, photo = "keep" } = options;
  const { ownParts } = input;
  const person = (spotId: string): ReviewPerson =>
    people.find((p) => p.spotId === spotId) ?? { spotId, name: "Someone", isYou: false };

  const { money } = input;
  const shares = input.shares.map((share) => ({
    ...person(share.spotId),
    amount: share.amount,
    originalAmount: share.originalAmount,
    own: ownParts === null ? null : (ownParts[share.spotId] ?? 0),
  }));
  // The extra minor unit lives in the equal part only, so take the own amounts out first. On a
  // cost in another currency the equal part is worked out in that currency.
  const unitOf = (share: (typeof shares)[number]) => (money.kind === "trip" ? share.amount : (share.originalAmount ?? 0));
  const equalPart = (share: (typeof shares)[number]) => unitOf(share) - (share.own ?? 0);
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
    // Amounts are shown in the money they were typed in; when either side is in another
    // currency, the trip-currency amount and the rate are listed too.
    const foreign = before.original !== null || money.kind !== "trip";
    note(
      "amount",
      before.original
        ? formatMoney(before.original.amount, before.original.currency)
        : formatMoney(before.amount, currency),
      money.kind === "trip" ? formatMoney(input.amount, currency) : formatMoney(money.original, money.currency),
    );
    if (foreign) note("main", formatMoney(before.amount, currency), formatMoney(input.amount, currency));
    const rateOf = (rate: string | null, other: string, isForeign: boolean) =>
      !isForeign ? "None" : rate === null ? "Card amount" : rateText(rate, other, currency);
    note(
      "rate",
      rateOf(before.original?.rate ?? null, before.original?.currency ?? "", before.original !== null),
      rateOf(money.kind === "rate" ? money.rate : null, money.kind === "trip" ? "" : money.currency, money.kind !== "trip"),
    );
    note("description", before.description, input.description);
    note("paidBy", person(before.paidBy).name, person(input.paidBy).name);
    note("spentOn", dayLabel(before.spentOn), dayLabel(input.spentOn));
    note("category", costCategoryOf(before.category).label, costCategoryOf(input.category).label);
    if (photo === "replace") changes.push({ field: "photo", before: before.hasPhoto ? "Photo" : "None", after: before.hasPhoto ? "Changed" : "Added" });
    if (photo === "remove" && before.hasPhoto) changes.push({ field: "photo", before: "Photo", after: "Removed" });

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
    original:
      money.kind === "trip"
        ? null
        : {
            currency: money.currency,
            amount: money.original,
            rate: money.kind === "rate" ? money.rate : null,
            effectiveRate: effectiveRateText({
              original: money.original,
              from: money.currency,
              main: input.amount,
              to: currency,
            }),
          },
    category: input.category,
    spentOn: input.spentOn,
    payer: person(input.paidBy),
    shares,
    uneven: ownParts !== null,
    withPhoto: !before && photo === "replace",
    rest,
    extraTakers,
    changes,
    shareChanges,
  };
}

export type DeleteCostState = { error?: string };

// The Cost page's "Add photo" box: an error to show under the hero, or nothing.
export type CostPhotoState = { error?: string };
