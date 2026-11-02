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

// For a trip header: "Mar 12-15, 2027", "Mar 30-Apr 2, 2027", "Mar 12, 2027".
export function formatTripRange(start: string, end: string): string {
  if (start === end) return MONTH_DAY_YEAR.format(parse(start).date);

  const s = parse(start);
  const e = parse(end);
  if (s.year !== e.year) {
    return `${MONTH_DAY_YEAR.format(s.date)}-${MONTH_DAY_YEAR.format(e.date)}`;
  }
  if (s.month === e.month) {
    return `${MONTH_DAY.format(s.date)}-${e.date.getUTCDate()}, ${e.year}`;
  }
  return `${MONTH_DAY.format(s.date)}-${MONTH_DAY.format(e.date)}, ${e.year}`;
}
