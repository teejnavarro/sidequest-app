// When something happens on a trip day, and the list of days itself. Plain data and plain
// functions: safe on the client and the server. Days are calendar days ("2027-05-08") and
// times are wall-clock times in the trip's own time zone, never converted.

export type SlotOption = { value: string; label: string };

export const SLOTS: SlotOption[] = [
  { value: "full", label: "Full day" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "time", label: "Exact time" },
];

export function isSlot(value: string): boolean {
  return SLOTS.some((slot) => slot.value === value);
}

// Where each part of day sorts, in minutes since midnight: the start of its range.
const SLOT_START: Record<string, number> = { morning: 0, afternoon: 720, evening: 1020 };

// Order within a day: Full day first, then each part of day at the start of its range, with
// exact times after the part of day they fall in (the half minute breaks the tie).
export function sortKey(slot: string, time: string | null): number {
  if (slot === "full") return -1;
  if (slot === "time" && time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes + 0.5;
  }
  return SLOT_START[slot] ?? 0;
}

export function compareItems(
  a: { slot: string; time: string | null; createdAt: Date },
  b: { slot: string; time: string | null; createdAt: Date },
): number {
  return (
    sortKey(a.slot, a.time) - sortKey(b.slot, b.time) ||
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

// "19:30" stays "19:30": times are shown the 24-hour way, as typed.
export function formatTime(time: string): string {
  return time;
}

// What the "when" column shows: "Morning", "Full day" or "19:30".
export function whenLabel(slot: string, time: string | null): string {
  if (slot === "time" && time) return formatTime(time);
  return SLOTS.find((option) => option.value === slot)?.label ?? slot;
}

export type TripDay = {
  day: string; // "2027-05-08"
  label: string; // "Sat, May 8"
  short: string; // "Sat 8", for the day chips
  number: number; // 1 for the first day
};

const LONG = new Intl.DateTimeFormat("en", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});
const WEEKDAY = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "short" });

function utcDate(day: string): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, dayOfMonth));
}

// "Sat, May 8" for any calendar day.
export function dayLabel(day: string): string {
  return LONG.format(utcDate(day));
}

// Every day from the trip's first to its last, both included. UTC arithmetic keeps a day
// from moving with the viewer's time zone or a clock change.
export function tripDays(start: string, end: string): TripDay[] {
  const days: TripDay[] = [];
  const last = utcDate(end).getTime();
  for (let date = utcDate(start); date.getTime() <= last; date = new Date(date.getTime() + 86_400_000)) {
    days.push({
      day: date.toISOString().slice(0, 10),
      label: dayLabel(date.toISOString().slice(0, 10)),
      short: `${WEEKDAY.format(date)} ${date.getUTCDate()}`,
      number: days.length + 1,
    });
  }
  return days;
}
