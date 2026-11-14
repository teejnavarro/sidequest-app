"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { firstNameOf } from "@/lib/display-name";
import type { MemberFormState } from "@/lib/member-form-state";
import { getMemberForOwner, removeMember, transferOwnership } from "@/lib/trips";

// Only the trip and spot ids are read from the form. They only say WHICH trip and person:
// who may make an owner or remove someone is decided inside the database statement.
function readText(formData: FormData, key: "tripId" | "spotId"): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const peopleAddress = (tripId: string) => `/trips/${tripId}/invite#people`;

// The invite page, the header count and My trips all show who is in.
function refresh(tripId: string) {
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath(`/trips/${tripId}/invite`);
  revalidatePath("/trips");
}

// A first name for the error text; never lets a second failure hide the first.
async function nameFor(tripId: string, spotId: string, ownerId: string): Promise<string> {
  try {
    const member = await getMemberForOwner(tripId, spotId, ownerId);
    return member ? firstNameOf(member.name) : "this person";
  } catch {
    return "this person";
  }
}

export async function transferOwnershipAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readText(formData, "tripId");
  const spotId = readText(formData, "spotId");
  if (tripId === "") redirect("/trips");
  if (spotId === "") redirect(peopleAddress(tripId));

  try {
    // Nothing changed (not the owner, person already gone) ends in the same place as success.
    await transferOwnership(tripId, spotId, user.id);
  } catch {
    return { error: `Couldn't make ${await nameFor(tripId, spotId, user.id)} the owner. Please try again.` };
  }

  refresh(tripId);
  redirect(peopleAddress(tripId)); // redirect works by throwing: keep it outside try/catch
}

export async function removeMemberAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const spotId = readText(formData, "spotId");
  if (tripId === "") redirect("/trips");
  if (spotId === "") redirect(peopleAddress(tripId));

  try {
    await removeMember(tripId, spotId, user.id);
  } catch {
    return { error: `Couldn't remove ${await nameFor(tripId, spotId, user.id)}. Please try again.` };
  }

  refresh(tripId);
  redirect(peopleAddress(tripId));
}
