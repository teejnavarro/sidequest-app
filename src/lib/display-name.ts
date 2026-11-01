export type DisplayNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

const MAX_LENGTH = 40;

export function validateDisplayName(raw: unknown): DisplayNameResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Please enter a name." };
  }
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length === 0) {
    return { ok: false, error: "Please enter a name." };
  }
  if (Array.from(name).length > MAX_LENGTH) {
    return { ok: false, error: "Keep it to 40 characters or fewer." };
  }
  return { ok: true, name };
}
