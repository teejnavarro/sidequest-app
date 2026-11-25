export type DisplayNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

const MAX_LENGTH = 40;

// What a deleted account is called everywhere. People can't pick it themselves.
export const FORMER_MEMBER_NAME = "Former member";

// Characters that show nothing on screen. Only used to spot blank-looking names:
// valid names keep them, because emoji and some scripts rely on them.
const INVISIBLE = /[\s\p{C}\p{Default_Ignorable_Code_Point}⠀]/gu;

// True when nothing visible is left after dropping spaces and invisible characters.
export function isBlankLooking(text: string): boolean {
  return text.replace(INVISIBLE, "").length === 0;
}

export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Please enter a name." };
  }
  const name = raw.trim().replace(/\s+/g, " ");
  if (isBlankLooking(name)) {
    return { ok: false, error: "Please enter a name." };
  }
  if (Array.from(name).length > MAX_LENGTH) {
    return { ok: false, error: "Keep it to 40 characters or fewer." };
  }
  if (name.toLowerCase() === FORMER_MEMBER_NAME.toLowerCase()) {
    return { ok: false, error: "That name is saved for deleted accounts. Pick another." };
  }
  return { ok: true, name };
}

// The first word of a name, for short lines like "Added by Maya".
export function firstNameOf(name: string): string {
  if (name === FORMER_MEMBER_NAME) return name;
  return name.trim().split(/\s+/)[0] || name;
}
