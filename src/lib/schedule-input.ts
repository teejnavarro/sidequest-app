import { isBlankLooking } from "@/lib/display-name";
import { isSlot } from "@/lib/schedule-options";

// What the add and move forms hold: everything is text. `kind` says which of the two
// kinds of schedule item this is: an approved idea, or something new with its own name.
export type ScheduleRaw = {
  kind: string;
  ideaId: string;
  name: string;
  notes: string;
  day: string;
  slot: string;
  time: string;
};

export type ScheduleField = keyof ScheduleRaw;
export type ScheduleErrors = Partial<Record<ScheduleField, string>>;

type When = { day: string; slot: string; time: string | null };

export type ScheduleInput =
  | ({ kind: "idea"; ideaId: string } & When)
  | ({ kind: "new"; name: string; notes: string | null } & When);

export type ScheduleInputResult =
  | { ok: true; value: ScheduleInput }
  | { ok: false; errors: ScheduleErrors };

const NAME_MAX = 80;
const NOTES_MAX = 300;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const length = (value: string) => Array.from(value).length;

// `tripDays` are the trip's own days ("YYYY-MM-DD"); a day outside them is refused.
// Anything but kind "idea" is a new item.
export function validateScheduleInput(
  raw: Record<string, unknown>,
  tripDays: string[],
): ScheduleInputResult {
  const errors: ScheduleErrors = {};

  const day = text(raw.day);
  if (!tripDays.includes(day)) errors.day = "Pick a day.";

  const slot = text(raw.slot);
  if (!isSlot(slot)) errors.slot = "Pick when.";

  // The time only counts for an exact time; for the other choices it is ignored.
  let time: string | null = null;
  if (slot === "time") {
    const rawTime = text(raw.time).trim();
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(rawTime)) {
      time = rawTime;
    } else {
      errors.time = "Enter a time, like 19:30.";
    }
  }

  const isIdea = text(raw.kind) === "idea";
  const ideaId = text(raw.ideaId);
  if (isIdea && ideaId === "") errors.ideaId = "Pick an idea.";

  // Name: new items only. Saved exactly as typed apart from tidied spaces.
  const name = text(raw.name).trim().replace(/\s+/g, " ");
  if (!isIdea) {
    if (isBlankLooking(name)) {
      errors.name = "Please enter a name.";
    } else if (length(name) > NAME_MAX) {
      errors.name = `Keep it to ${NAME_MAX} characters or fewer.`;
    }
  }

  // Notes: new items only. Line breaks are kept.
  const rawNotes = text(raw.notes).replace(/\r\n/g, "\n").trim();
  const notes = isBlankLooking(rawNotes) ? null : rawNotes;
  if (!isIdea && notes !== null && length(notes) > NOTES_MAX) {
    errors.notes = `Keep it to ${NOTES_MAX} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const when = { day, slot, time };
  return {
    ok: true,
    value: isIdea ? { kind: "idea", ideaId, ...when } : { kind: "new", name, notes, ...when },
  };
}
