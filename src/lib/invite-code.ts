// An invite code is a random UUID, for example "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12".
// Check this shape before any database read and before building a return address, so
// junk (or something sneaky) in a link is turned away early.
const INVITE_CODE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInviteCode(value: string): boolean {
  return INVITE_CODE.test(value);
}
