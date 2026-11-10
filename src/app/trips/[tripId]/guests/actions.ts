"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { validateGuestName } from "@/lib/guest-input";
import type { GuestFormState, RemoveGuestState } from "@/lib/guest-form-state";
import { addGuest, removeGuest, renameGuest } from "@/lib/trips";

// Only the named name field and the trip and spot ids are read from the form. The ids only
// say WHICH trip or guest: who may add, rename or remove is decided inside the database
// query, not here.
function readText(formData: FormData, key: "name" | "tripId" | "spotId"): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const peopleAddress = (tripId: string) => `/trips/${tripId}/invite#people`;
const SAVE_FAILED = "Couldn't save the guest. Please try again.";
const REMOVE_FAILED = "Couldn't remove the guest. Please try again.";
const duplicateMessage = (name: string) => `There's already a guest called ${name}.`;

// The header count, the invite page and My trips all show guests.
function refresh(tripId: string) {
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath(`/trips/${tripId}/invite`);
  revalidatePath("/trips");
}

export async function addGuestAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readText(formData, "tripId");
  if (tripId === "") redirect("/trips");

  const typed = readText(formData, "name");
  const result = validateGuestName(typed);
  if (!result.ok) return { error: result.error, name: typed };

  try {
    // A person who is not in the trip adds nothing; the same redirect follows either way.
    const added = await addGuest(tripId, user.id, result.name);
    if (added === "duplicate") return { error: duplicateMessage(result.name), name: typed };
  } catch {
    return { error: SAVE_FAILED, name: typed };
  }

  refresh(tripId);
  redirect(peopleAddress(tripId)); // redirect works by throwing: keep it outside try/catch
}

export async function renameGuestAction(
  _prev: GuestFormState,
  formData: FormData,
): Promise<GuestFormState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const spotId = readText(formData, "spotId");
  if (tripId === "") redirect("/trips");
  if (spotId === "") redirect(peopleAddress(tripId));

  const typed = readText(formData, "name");
  const result = validateGuestName(typed);
  if (!result.ok) return { error: result.error, name: typed };

  try {
    // Changing nothing (not yours, not found) ends in the same place as success.
    const renamed = await renameGuest(tripId, spotId, user.id, result.name);
    if (renamed === "duplicate") return { error: duplicateMessage(result.name), name: typed };
  } catch {
    return { error: SAVE_FAILED, name: typed };
  }

  refresh(tripId);
  redirect(peopleAddress(tripId));
}

export async function removeGuestAction(
  _prev: RemoveGuestState,
  formData: FormData,
): Promise<RemoveGuestState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const spotId = readText(formData, "spotId");
  if (tripId === "") redirect("/trips");
  if (spotId === "") redirect(peopleAddress(tripId));

  try {
    await removeGuest(tripId, spotId, user.id);
  } catch {
    return { error: REMOVE_FAILED };
  }

  refresh(tripId);
  redirect(peopleAddress(tripId));
}
