import { isBlankLooking } from "@/lib/display-name";
import { isCostCategory } from "@/lib/cost-options";
import { CURRENCIES } from "@/lib/trip-options";
import {
  allocateLike,
  convertByRate,
  formatMoney,
  minorDigits,
  parseAmount,
  parseRate,
  splitByItems,
  splitEqually,
  type OwnAmount,
  type Share,
} from "@/lib/money";
import { isCalendarDay } from "@/lib/trip-dates";

// How the cost was entered. "trip": in the trip's currency. "rate": in another currency,
// converted at "1 <trip currency> = rate <currency>". "charged": in another currency, with the
// trip-currency amount the card was charged typed in. `original` is minor units of `currency`.
export type CostMoney =
  | { kind: "trip" }
  | { kind: "rate"; currency: string; original: number; rate: string }
  | { kind: "charged"; currency: string; original: number };

// A person's part: `amount` in the trip currency, and `originalAmount` in the cost's own
// currency (null when the cost is in the trip currency).
export type CostShare = Share & { originalAmount: number | null };

// What a checked cost looks like: the amount in the trip currency (minor units) and the shares,
// which always add up to the amount.
export type CostInput = {
  description: string;
  amount: number;
  paidBy: string; // a spot id
  category: string | null;
  spentOn: string; // "YYYY-MM-DD"
  shares: CostShare[]; // in the trip's list order
  money: CostMoney;
};

// What the form holds: everything is text.
export type CostRaw = {
  description: string;
  amount: string;
  paidBy: string;
  sharedBy: string[];
  spentOn: string;
  category: string;
  split: string; // "equal" or "items"
  own: Record<string, string>; // spot id -> what that person had, as typed
  // `amount` and `own` are in this currency; "" means the trip's currency.
  currency: string;
  fx: string; // "rate" or "charged", for a currency other than the trip's
  rate: string; // "1 <trip currency> = rate <currency>", as typed
  charged: string; // the trip-currency amount the card charged, as typed
};

export type CostField = keyof CostRaw;
export type CostErrors = Partial<Record<CostField, string>>;

// `ownParts` is display data for the review (what each person had on an uneven split, null
// for an equal one). Saving uses `shares` only.
export type CostInputResult =
  | { ok: true; value: CostInput & { ownParts: Record<string, number> | null } }
  | { ok: false; errors: CostErrors };

const DESCRIPTION_MAX = 80;
const FIRST_DAY = "2000-01-01";
const LAST_DAY = "2100-12-31";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const length = (value: string) => Array.from(value).length;

function textRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

// Checks a cost against the trip's currency and its spots (in the trip's list order) and
// works out the equal shares. Anything not in `spotIds` is refused, so nothing from the
// browser is trusted.
export function validateCostInput(
  raw: Record<string, unknown>,
  context: { currency: string; spotIds: string[]; names: Record<string, string> },
): CostInputResult {
  const errors: CostErrors = {};

  const description = text(raw.description).trim().replace(/\s+/g, " ");
  if (isBlankLooking(description)) {
    errors.description = "Please enter what it was.";
  } else if (length(description) > DESCRIPTION_MAX) {
    errors.description = `Keep it to ${DESCRIPTION_MAX} characters or fewer.`;
  }

  // The cost's own currency: the trip's when empty or the same.
  const typedCurrency = text(raw.currency);
  const known = CURRENCIES.some((option) => option.value === typedCurrency);
  if (typedCurrency !== "" && !known) errors.currency = "Pick a currency from the list.";
  const selected = known ? typedCurrency : context.currency;
  const foreign = selected !== context.currency;

  const parsed = parseAmount(text(raw.amount), selected);
  if (!parsed.ok) errors.amount = parsed.error;

  // The amount in the trip currency: typed (trip cost), typed as the card charge, or converted.
  let main: number | null = !foreign && parsed.ok ? parsed.minor : null;
  let money: CostMoney = { kind: "trip" };
  if (foreign && parsed.ok) {
    if (text(raw.fx) === "charged") {
      const charged = parseAmount(text(raw.charged), context.currency);
      if (!charged.ok) errors.charged = charged.error;
      else {
        main = charged.minor;
        money = { kind: "charged", currency: selected, original: parsed.minor };
      }
    } else {
      const rate = parseRate(text(raw.rate));
      if (!rate.ok) errors.rate = rate.error;
      else {
        main = convertByRate({ original: parsed.minor, from: selected, to: context.currency, rate: rate.rate });
        if (main === null) errors.rate = rateRangeError(parsed.minor, selected, rate.rate, context.currency);
        else money = { kind: "rate", currency: selected, original: parsed.minor, rate: rate.rate };
      }
    }
  }

  const paidBy = text(raw.paidBy);
  if (!context.spotIds.includes(paidBy)) errors.paidBy = "Pick who paid.";

  // Duplicates and strangers are dropped; what is left keeps the trip's list order.
  const picked = new Set(textList(raw.sharedBy));
  const sharedBy = context.spotIds.filter((id) => picked.has(id));
  if (sharedBy.length === 0 || [...picked].some((id) => !context.spotIds.includes(id))) {
    errors.sharedBy = "Pick who shares it.";
  }

  const spentOn = text(raw.spentOn);
  if (!isCalendarDay(spentOn) || spentOn < FIRST_DAY || spentOn > LAST_DAY) {
    errors.spentOn = "Pick a date.";
  }

  const category = text(raw.category);
  if (category !== "" && !isCostCategory(category)) errors.category = "Pick a category from the list.";

  // The split is worked out in the cost's own currency; a foreign cost is then converted share
  // by share, so the shares always add up to the trip-currency amount.
  let shares: Share[] | null = null;
  let ownParts: Record<string, number> | null = null;
  if (text(raw.split) === "items" && parsed.ok && !errors.sharedBy) {
    const outcome = splitOwn(textRecord(raw.own), {
      ...context,
      currency: selected,
      total: parsed.minor,
      sharedBy,
      paidBy,
    });
    if ("error" in outcome) errors.own = outcome.error;
    else ({ shares, ownParts } = outcome);
  }

  if (Object.keys(errors).length > 0 || !parsed.ok || main === null) return { ok: false, errors };
  const own = shares ?? splitEqually(parsed.minor, sharedBy, paidBy);
  let finalShares: CostShare[];
  if (!foreign) {
    finalShares = own.map((share) => ({ ...share, originalAmount: null }));
  } else {
    finalShares = allocateLike(main, own, paidBy).map((share, index) => ({
      ...share,
      originalAmount: own[index]!.amount,
    }));
    const empty = finalShares.find((share) => share.amount === 0 && share.originalAmount! > 0)?.spotId;
    if (empty) {
      const who = context.names[empty] === "You";
      const label = context.names[empty] ?? "Someone";
      const message = `${who ? "Your" : `${label}'s`} share comes to ${formatMoney(0, context.currency)} in ${context.currency}. Add to ${who ? "your" : "their"} amount or untick ${who ? "yourself" : "them"}.`;
      if (ownParts === null) errors.sharedBy = message;
      else errors.own = message;
      return { ok: false, errors };
    }
  }
  return {
    ok: true,
    value: {
      description,
      amount: main,
      paidBy,
      category: category === "" ? null : category,
      spentOn,
      shares: finalShares,
      money,
      ownParts,
    },
  };
}

// Why a rate gave no usable amount: under one minor unit of the trip currency, or over the
// largest amount. Only picks the message (the check itself is exact, in convertByRate).
function rateRangeError(original: number, from: string, rate: string, to: string): string {
  const approx = original / 10 ** minorDigits(from) / Number(rate);
  if (approx * 10 ** minorDigits(to) < 1) {
    return `That rate makes it less than ${formatMoney(1, to)}.`;
  }
  return "That's too large.";
}

// Works out an uneven split from the typed own amounts, or says what is wrong with them. The
// first problem found is the one reported. "You" reads as "your" / "yourself".
function splitOwn(
  typed: Record<string, string>,
  options: {
    currency: string;
    spotIds: string[];
    names: Record<string, string>;
    total: number;
    sharedBy: string[];
    paidBy: string;
  },
): { error: string } | { shares: Share[]; ownParts: Record<string, number> } {
  const { currency, spotIds, names, total, sharedBy, paidBy } = options;
  const name = (id: string) => names[id] ?? "Someone";
  const you = (id: string) => name(id) === "You";
  const own: Record<string, number> = {};
  for (const id of spotIds) {
    const raw = (typed[id] ?? "").trim();
    if (raw === "") continue;
    const parsed = parseAmount(raw, currency);
    // Zero is the same as an empty box.
    if (!parsed.ok && parsed.error === "Enter an amount above zero.") continue;
    if (!parsed.ok) {
      return { error: `Check ${you(id) ? "your" : `${name(id)}'s`} amount. ${parsed.error}` };
    }
    own[id] = parsed.minor;
  }
  for (const id of Object.keys(own)) {
    if (!sharedBy.includes(id)) {
      return {
        error: you(id)
          ? "Tick yourself in Split between, or clear your amount."
          : `Tick ${name(id)} in Split between, or clear their amount.`,
      };
    }
  }
  const outcome = splitOwnRule({
    total,
    sharedBy,
    own: Object.entries(own).map(([spotId, minor]) => ({ spotId, own: minor })),
    paidBy,
    currency,
    names,
  });
  if ("error" in outcome) return outcome;
  return { shares: outcome.shares, ownParts: own };
}

// The rule for an uneven split, shared by the server (splitOwn) and the form's helper line, so
// both say the same thing: what each person had plus an equal part of the rest. Amounts are in
// `currency`. Either the shares (and what was left over to share), or the first problem.
export function splitOwnRule(options: {
  total: number;
  sharedBy: string[];
  own: OwnAmount[];
  paidBy: string;
  currency: string;
  names: Record<string, string>;
}): { error: string } | { shares: Share[]; rest: number } {
  const { total, sharedBy, own, paidBy, currency, names } = options;
  const name = (id: string) => names[id] ?? "Someone";
  const you = (id: string) => name(id) === "You";
  const result = splitByItems(total, sharedBy, own, paidBy);
  if (!result) {
    const given = own.reduce((sum, item) => sum + item.own, 0);
    return { error: `That's ${formatMoney(given - total, currency)} more than the total.` };
  }
  // No one ticked may end with a share of 0 (owner decision 2026-11-20), so a reopened uneven
  // cost always saves again unchanged.
  const empty = result.shares.find((share) => share.amount === 0)?.spotId;
  if (empty && result.rest === 0) {
    const zero = formatMoney(0, currency);
    return {
      error: you(empty)
        ? `Your share comes to ${zero}. Untick yourself or add an amount.`
        : `${name(empty)}'s share comes to ${zero}. Untick ${name(empty)} or add an amount.`,
    };
  }
  if (empty) {
    return {
      error: `${formatMoney(result.rest, currency)} left over can't be shared by ${sharedBy.length} people. Add it to someone's amount.`,
    };
  }
  return { shares: result.shares.map(({ spotId, amount }) => ({ spotId, amount })), rest: result.rest };
}
