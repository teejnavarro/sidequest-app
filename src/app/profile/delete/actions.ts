"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";
import { getCurrentUser } from "@/lib/current-user";
import type { MemberFormState } from "@/lib/member-form-state";

// Always ends in a redirect. The form sends nothing: the account is the signed-in person's.
export async function deleteAccountAction(): Promise<MemberFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  // A shared trip is still theirs (handed back a moment ago): nothing was changed.
  if ((await deleteAccount(user.id)) === "owns-shared-trips") redirect("/profile/delete");

  // The session row is already gone; this clears the cookie. A failure only leaves a stale
  // cookie, and the pages send that visitor home.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {}
  redirect("/?deleted=1");
}
