"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { validateIdeaInput } from "@/lib/idea-input";
import type { IdeaFormState, IdeaFormValues } from "@/lib/idea-form-state";
import { createIdea, deleteIdea, updateIdea } from "@/lib/ideas";

// Only these named fields are ever read from the form, plus the trip and idea ids. Anything
// else a visitor adds (a createdBy, say) is never looked at. The ids only say WHICH trip or
// idea: who may add, change or delete is decided inside the database query, not here.
function readValues(formData: FormData): IdeaFormValues {
  const text = (key: keyof IdeaFormValues) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    type: text("type"),
    duration: text("duration"),
    link: text("link"),
    area: text("area"),
    costPerPerson: text("costPerPerson"),
    notes: text("notes"),
  };
}

function readId(formData: FormData, key: "tripId" | "ideaId"): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const listAddress = (tripId: string) => `/trips/${tripId}/ideas`;
const SAVE_FAILED = "Couldn't save the idea. Please try again.";

export async function createIdeaAction(
  _prev: IdeaFormState,
  formData: FormData,
): Promise<IdeaFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readId(formData, "tripId");
  if (tripId === "") redirect("/trips");

  const values = readValues(formData);
  const result = validateIdeaInput(values);
  if (!result.ok) return { errors: result.errors, values };

  try {
    // A person who is not in the trip adds nothing; the same redirect follows either way.
    await createIdea(tripId, user.id, result.value);
  } catch {
    return { errors: { form: SAVE_FAILED }, values };
  }

  revalidatePath(listAddress(tripId));
  redirect(listAddress(tripId)); // redirect works by throwing: keep it outside try/catch
}

export async function updateIdeaAction(
  _prev: IdeaFormState,
  formData: FormData,
): Promise<IdeaFormState> {
  const user = await getCurrentUser();

  const tripId = readId(formData, "tripId");
  const ideaId = readId(formData, "ideaId");
  if (tripId === "") redirect("/trips");
  if (ideaId === "") redirect(listAddress(tripId));

  const values = readValues(formData);
  const result = validateIdeaInput(values);
  if (!result.ok) return { errors: result.errors, values };

  try {
    // Changing nothing (not yours, not found) ends in the same place as success.
    await updateIdea(tripId, ideaId, user.id, result.value);
  } catch {
    return { errors: { form: SAVE_FAILED }, values };
  }

  revalidatePath(listAddress(tripId));
  redirect(listAddress(tripId));
}

export type DeleteIdeaState = { error?: string };

export async function deleteIdeaAction(
  _prev: DeleteIdeaState,
  formData: FormData,
): Promise<DeleteIdeaState> {
  const user = await getCurrentUser();

  const tripId = readId(formData, "tripId");
  const ideaId = readId(formData, "ideaId");
  if (tripId === "") redirect("/trips");
  if (ideaId === "") redirect(listAddress(tripId));

  try {
    await deleteIdea(tripId, ideaId, user.id);
  } catch {
    return { error: "Couldn't delete the idea. Please try again." };
  }

  revalidatePath(listAddress(tripId));
  redirect(listAddress(tripId));
}
