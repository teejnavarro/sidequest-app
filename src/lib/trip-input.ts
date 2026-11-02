import { isBlankLooking } from "@/lib/display-name";
import { CURRENCIES, TIME_ZONES } from "@/lib/trip-options";

export type TripInput = {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeZone: string;
  currency: string;
};

export type TripField = keyof TripInput;
export type TripErrors = Partial<Record<TripField, string>>;

export type TripInputResult =
  | { ok: true; value: TripInput }
  | { ok: false; errors: TripErrors };

const NAME_MAX = 60;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

type DateCheck = { ok: true; date: string } | { ok: false; error: string };

// A real calendar day written as YYYY-MM-DD. Checked by hand, never through the
// user's local time, so no day can shift.
function checkDate(raw: unknown, which: "start" | "end"): DateCheck {
  const article = which === "start" ? "a" : "an";
  const missing = { ok: false, error: `Pick ${article} ${which} date.` } as const;
  const text = typeof raw === "string" ? raw.trim() : "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return missing;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
  if (!real) {
    return { ok: false, error: "That date does not exist. Check the day and month." };
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { ok: false, error: `Pick a year between ${MIN_YEAR} and ${MAX_YEAR}.` };
  }
  return { ok: true, date: text };
}

export function validateTripInput(raw: Record<string, unknown>): TripInputResult {
  const errors: TripErrors = {};

  // Name: accents and emoji stay exactly as typed. Only spaces are tidied.
  const rawName = typeof raw.name === "string" ? raw.name : "";
  const name = rawName.trim().replace(/\s+/g, " ");
  if (isBlankLooking(name)) {
    errors.name = "Please enter a trip name.";
  } else if (Array.from(name).length > NAME_MAX) {
    errors.name = `Keep it to ${NAME_MAX} characters or fewer.`;
  }

  const start = checkDate(raw.startDate, "start");
  const end = checkDate(raw.endDate, "end");
  if (!start.ok) errors.startDate = start.error;
  if (!end.ok) errors.endDate = end.error;
  // YYYY-MM-DD sorts correctly as plain text. Same-day trips are fine.
  if (start.ok && end.ok && end.date < start.date) {
    errors.endDate = "The end date can't be before the start date.";
  }

  const timeZone = typeof raw.timeZone === "string" ? raw.timeZone : "";
  if (!TIME_ZONES.some((zone) => zone.value === timeZone)) {
    errors.timeZone = "Pick a time zone from the list.";
  }

  const currency = typeof raw.currency === "string" ? raw.currency : "";
  if (!CURRENCIES.some((option) => option.value === currency)) {
    errors.currency = "Pick a currency from the list.";
  }

  if (!start.ok || !end.ok || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { name, startDate: start.date, endDate: end.date, timeZone, currency },
  };
}
