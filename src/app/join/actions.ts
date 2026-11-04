"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOptionalUser } from "@/lib/current-user";
import { isInviteCode } from "@/lib/invite-code";
import { joinTripByInviteCode } from "@/lib/trips";

export type JoinFormState = { message: string };

function readCode(formData: FormData): string | null {
  const value = formData.get("code");
  return typeof value === "string" && isInviteCode(value) ? value.toLowerCase() : null;
}

// Sign in with Google, then come back to this same invite page. The return address is
// built here from a code that passed the shape check. It is never read from the form.
export async function signInToJoin(formData: FormData) {
  const code = readCode(formData);
  if (!code) redirect("/");

  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: `/join/${code}` },
    headers: await headers(),
  });
  if (!result.url) redirect("/");
  redirect(result.url);
}

// The only place anyone is added to a trip. It runs when the person taps Join trip, never
// while a page loads, so link previews and prefetching can't add anyone.
export async function joinTripAction(
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const code = readCode(formData);
  if (!code) redirect("/");

  const user = await getOptionalUser();
  if (!user) redirect(`/join/${code}`);

  let tripId: string | null;
  try {
    tripId = await joinTripByInviteCode(code, user.id);
  } catch {
    return { message: "Couldn't join the trip. Please try again." };
  }
  if (!tripId) return { message: "This invite link isn't working." };

  revalidatePath("/trips");
  redirect(`/trips/${tripId}`); // redirect works by throwing: keep it outside try/catch
}
