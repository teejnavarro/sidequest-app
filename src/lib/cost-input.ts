import { isBlankLooking } from "@/lib/display-name";
import { isCostCategory } from "@/lib/cost-options";
import { parseAmount, splitEqually, type Share } from "@/lib/money";
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
};

export type CostField = keyof CostRaw;
export type CostErrors = Partial<Record<CostField, string>>;

export type CostInputResult =
  | { ok: true; value: CostInput }
  | { ok: false; errors: CostErrors };

const DESCRIPTION_MAX = 80;
const FIRST_DAY = "2000-01-01";
const LAST_DAY = "2100-12-31";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const length = (value: string) => Array.from(value).length;

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

// Checks a cost against the trip's currency and its spots (in the trip's list order) and
// works out the equal shares. Anything not in `spotIds` is refused, so nothing from the
// browser is trusted.
export function validateCostInput(
  raw: Record<string, unknown>,
  context: { currency: string; spotIds: string[] },
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

  if (Object.keys(errors).length > 0 || !parsed.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      description,
      amount: parsed.minor,
      paidBy,
      category: category === "" ? null : category,
      spentOn,
      shares: splitEqually(parsed.minor, sharedBy, paidBy),
    },
  };
}
