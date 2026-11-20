import { isBlankLooking } from "@/lib/display-name";
import { isCostCategory } from "@/lib/cost-options";
import { formatMoney, parseAmount, splitByItems, splitEqually, type Share } from "@/lib/money";
import { isCalendarDay } from "@/lib/trip-dates";

// What a checked cost looks like: the amount in minor units and the equal shares, which
// always come from splitEqually and add up to the amount.
export type CostInput = {
  description: string;
  amount: number;
  paidBy: string; // a spot id
  category: string | null;
  spentOn: string; // "YYYY-MM-DD"
  shares: Share[]; // in the trip's list order
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

  const parsed = parseAmount(text(raw.amount), context.currency);
  if (!parsed.ok) errors.amount = parsed.error;

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

  // Uneven split: what each person had, then the rest shared equally. Only when asked for.
  let shares: Share[] | null = null;
  let ownParts: Record<string, number> | null = null;
  if (text(raw.split) === "items" && parsed.ok && !errors.sharedBy) {
    const outcome = splitOwn(textRecord(raw.own), { ...context, total: parsed.minor, sharedBy, paidBy });
    if ("error" in outcome) errors.own = outcome.error;
    else ({ shares, ownParts } = outcome);
  }

  if (Object.keys(errors).length > 0 || !parsed.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      description,
      amount: parsed.minor,
      paidBy,
      category: category === "" ? null : category,
      spentOn,
      shares: shares ?? splitEqually(parsed.minor, sharedBy, paidBy),
      ownParts,
    },
  };
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
  const result = splitByItems(
    total,
    sharedBy,
    Object.entries(own).map(([spotId, minor]) => ({ spotId, own: minor })),
    paidBy,
  );
  if (!result) {
    const given = Object.values(own).reduce((sum, minor) => sum + minor, 0);
    return { error: `That's ${formatMoney(given - total, currency)} more than the total.` };
  }
  if (result.rest === 0) {
    const empty = sharedBy.find((id) => own[id] === undefined);
    if (empty) {
      const zero = formatMoney(0, currency);
      return {
        error: you(empty)
          ? `Your share comes to ${zero}. Untick yourself or add an amount.`
          : `${name(empty)}'s share comes to ${zero}. Untick ${name(empty)} or add an amount.`,
      };
    }
  }
  return { shares: result.shares.map(({ spotId, amount }) => ({ spotId, amount })), ownParts: own };
}
