"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOptionalUser } from "@/lib/current-user";
import { isInviteCode } from "@/lib/invite-code";
import {
  getTripByInviteCode,
  hasLeftSpot,
  joinTripByInviteCode,
  listUnclaimedGuestsByInviteCode,
} from "@/lib/trips";

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
//
// The form's "claim" field is "new" (the person is new to the trip) or a guest's spot id.
// When the trip has unclaimed guests, the person must answer one way or the other, unless they
// left the trip before: the page asks them nothing, and joining switches their old spot back on. The spot
// id only says WHICH spot: whether it can be taken is decided inside the database update.
export async function joinTripAction(
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const code = readCode(formData);
  if (!code) redirect("/");

  const user = await getOptionalUser();
  if (!user) redirect(`/join/${code}`);

  const answer = formData.get("claim");
  const claim = typeof answer === "string" ? answer : "";

  let joined: Awaited<ReturnType<typeof joinTripByInviteCode>>;
  try {
    if (claim === "" && (await listUnclaimedGuestsByInviteCode(code)).length > 0) {
      const invited = await getTripByInviteCode(code);
      if (!invited || !(await hasLeftSpot(invited.id, user.id))) {
        return { message: "Pick your name, or No, I'm new." };
      }
    }
    joined = await joinTripByInviteCode(code, user.id, claim === "" || claim === "new" ? null : claim);
  } catch {
    return { message: "Couldn't join the trip. Please try again." };
  }
  if (joined === "taken") {
    revalidatePath(`/join/${code}`); // so the list of guests shows who is left
    return { message: "That spot was just taken. Pick again." };
  }
  if (!joined) return { message: "This invite link isn't working." };

  revalidatePath("/trips");
  redirect(`/trips/${joined.tripId}/schedule`); // redirect works by throwing: keep it outside try/catch
}
