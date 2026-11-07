import { isBlankLooking } from "@/lib/display-name";
import { isDuration, isIdeaType } from "@/lib/idea-options";

export type IdeaInput = {
  name: string;
  type: string;
  duration: string;
  link: string | null;
  area: string | null;
  costPerPerson: number | null; // whole units of the trip's currency
  notes: string | null;
};

// What the form holds: everything is text.
export type IdeaRaw = {
  name: string;
  type: string;
  duration: string;
  link: string;
  area: string;
  costPerPerson: string;
  notes: string;
};

export type IdeaField = keyof IdeaRaw;
export type IdeaErrors = Partial<Record<IdeaField, string>>;

export type IdeaInputResult =
  | { ok: true; value: IdeaInput }
  | { ok: false; errors: IdeaErrors };

const NAME_MAX = 80;
const AREA_MAX = 60;
const NOTES_MAX = 500;
const LINK_MAX = 500;
const COST_MAX = 10_000_000;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const length = (value: string) => Array.from(value).length;

// Optional one-line text: spaces tidied, accents and symbols untouched, blank means none.
function optionalLine(value: string): string | null {
  const tidy = value.trim().replace(/\s+/g, " ");
  return isBlankLooking(tidy) ? null : tidy;
}

export function validateIdeaInput(raw: Record<string, unknown>): IdeaInputResult {
  const errors: IdeaErrors = {};

  // Name: required. Saved exactly as typed apart from tidied spaces.
  const name = text(raw.name).trim().replace(/\s+/g, " ");
  if (isBlankLooking(name)) {
    errors.name = "Please enter the idea.";
  } else if (length(name) > NAME_MAX) {
    errors.name = `Keep it to ${NAME_MAX} characters or fewer.`;
  }

  const type = text(raw.type);
  if (!isIdeaType(type)) errors.type = "Pick a type.";

  const duration = text(raw.duration);
  if (!isDuration(duration)) errors.duration = "Pick how long it takes.";

  // Link: only web addresses, so nothing like javascript: can ever become a link.
  let link: string | null = null;
  const rawLink = text(raw.link).trim();
  if (rawLink !== "") {
    let ok = false;
    try {
      const protocol = new URL(rawLink).protocol;
      ok = protocol === "http:" || protocol === "https:";
    } catch {
      ok = false;
    }
    if (!ok) {
      errors.link = "Paste a full link, starting with https://";
    } else if (length(rawLink) > LINK_MAX) {
      errors.link = "That link is too long.";
    } else {
      link = rawLink;
    }
  }

  const area = optionalLine(text(raw.area));
  if (area !== null && length(area) > AREA_MAX) {
    errors.area = `Keep it to ${AREA_MAX} characters or fewer.`;
  }

  // Notes: line breaks are kept.
  const rawNotes = text(raw.notes).replace(/\r\n/g, "\n").trim();
  const notes = isBlankLooking(rawNotes) ? null : rawNotes;
  if (notes !== null && length(notes) > NOTES_MAX) {
    errors.notes = `Keep it to ${NOTES_MAX} characters or fewer.`;
  }

  // Cost: a whole amount. Spaces and commas are allowed while typing ("1,200").
  let costPerPerson: number | null = null;
  const rawCost = text(raw.costPerPerson).replace(/[\s,]/g, "");
  if (rawCost !== "") {
    if (/^\d{1,8}$/.test(rawCost) && Number(rawCost) <= COST_MAX) {
      costPerPerson = Number(rawCost);
    } else {
      errors.costPerPerson = "Enter a whole amount, like 120.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, type, duration, link, area, costPerPerson, notes } };
}
