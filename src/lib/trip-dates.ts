// Trip dates are calendar days ("2027-03-12"), not moments in time. Parse the text
// directly and format in UTC so the viewer's own time zone can never move a day.

const MONTH_DAY = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function parse(day: string): { date: Date; year: number; month: number } {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return { date: new Date(Date.UTC(year, month - 1, dayOfMonth)), year, month };
}

// For the route line on a trip card: "Mar 12" and "Mar 15, 2027".
// When the trip crosses a year, both ends show their year.
export function formatTripDates(
  start: string,
  end: string,
): { start: string; end: string } {
  const s = parse(start);
  const e = parse(end);
  return {
    start: (s.year === e.year ? MONTH_DAY : MONTH_DAY_YEAR).format(s.date),
    end: MONTH_DAY_YEAR.format(e.date),
  };
}

// For a trip header, with an en dash: "Mar 12–15, 2027", "Mar 30–Apr 2, 2027", "Mar 12, 2027".
export function formatTripRange(start: string, end: string): string {
  if (start === end) return MONTH_DAY_YEAR.format(parse(start).date);

  const s = parse(start);
  const e = parse(end);
  if (s.year !== e.year) {
    return `${MONTH_DAY_YEAR.format(s.date)}–${MONTH_DAY_YEAR.format(e.date)}`;
  }
  if (s.month === e.month) {
    return `${MONTH_DAY.format(s.date)}–${e.date.getUTCDate()}, ${e.year}`;
  }
  return `${MONTH_DAY.format(s.date)}–${MONTH_DAY.format(e.date)}, ${e.year}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).date.getTime() - parse(from).date.getTime()) / DAY_MS);
}

// Today's calendar day in the trip's own time zone ("YYYY-MM-DD"). A trip in Manila
// starts when it is the trip's day in Manila, not in the viewer's place. An unknown zone
// falls back to UTC. `now` is passed in so this stays a plain, testable function.
export function todayInZone(timeZone: string, now: Date): string {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en", { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" });
  }
  const parts = formatter.formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// The small tag on a trip: "In 12 days", "Tomorrow", "Day 2 of 4", "Today" (a one-day
// trip), or "Trip's over". All three arguments are calendar days ("YYYY-MM-DD").
export function tripTimeLabel(start: string, end: string, today: string): string {
  const untilStart = daysBetween(today, start);
  if (untilStart > 0) return untilStart === 1 ? "Tomorrow" : `In ${untilStart} days`;
  if (daysBetween(today, end) < 0) return "Trip's over";
  if (start === end) return "Today";
  return `Day ${daysBetween(start, today) + 1} of ${daysBetween(start, end) + 1}`;
}

// True for a real calendar day written as YYYY-MM-DD, such as "2027-03-12", and false for
// anything else, including "2027-02-30" and a half-typed date.
export function isCalendarDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}
