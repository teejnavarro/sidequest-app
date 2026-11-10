// What the guest forms remember between tries. Lives outside the "use server" file because
// such files may only export functions.
export type GuestFormState = { error?: string; name: string };

export const emptyGuestForm: GuestFormState = { name: "" };

export type RemoveGuestState = { error?: string };
