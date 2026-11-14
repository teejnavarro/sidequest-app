"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import type { MemberFormState } from "@/lib/member-form-state";
import { resetInviteCode } from "@/lib/trips";

// Gives the trip a new invite link, for its owner only. Whether or not anything changed, the
// person ends up on Invite people: who may do this is decided inside the statement.
export async function resetInviteLinkAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripIdField = formData.get("tripId");
  const tripId = typeof tripIdField === "string" ? tripIdField : "";
  if (tripId === "") redirect("/trips");

  try {
    await resetInviteCode(tripId, user.id);
  } catch {
    return { error: "Couldn't make a new link. Please try again." };
  }

  revalidatePath(`/trips/${tripId}/invite`);
  redirect(`/trips/${tripId}/invite`); // redirect works by throwing: keep it outside try/catch
}
