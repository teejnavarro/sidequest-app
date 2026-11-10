import { validateDisplayName } from "@/lib/display-name";

export type GuestNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

// A guest's name follows the same rules as a display name: trimmed, spaces collapsed,
// blank-looking refused, at most 40 characters, accents kept.
export function validateGuestName(raw: unknown): GuestNameResult {
  return validateDisplayName(raw);
}
