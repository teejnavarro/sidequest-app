// What the member, invite-link and leave forms remember between tries. Lives outside the
// "use server" files because such files may only export functions.
export type MemberFormState = { error?: string };
