"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { validateIdeaInput } from "@/lib/idea-input";
import type { IdeaFormState, IdeaFormValues } from "@/lib/idea-form-state";
import {
  approveIdea,
  createIdea,
  deleteIdea,
  setVote,
  unapproveIdea,
  updateIdea,
  type VoteResult,
} from "@/lib/ideas";

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
const VOTE_FAILED = "Couldn't save your vote. Please try again.";

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

export type VoteActionResult = VoteResult | { error: string };

// Gives, switches or takes back the signed-in person's vote. It reads only tripId, ideaId and
// choice ("up" or "down"). It does not revalidate the page, so the list keeps its order until
// the next visit; the counts come back here instead. Who may vote is decided in setVote.
export async function voteAction(formData: FormData): Promise<VoteActionResult> {
  const user = await getCurrentUser();

  const tripId = readId(formData, "tripId");
  const ideaId = readId(formData, "ideaId");
  const choice = formData.get("choice");
  if (tripId === "" || ideaId === "" || (choice !== "up" && choice !== "down")) {
    return { error: VOTE_FAILED };
  }

  try {
    const result = await setVote(tripId, ideaId, user.id, choice === "up" ? 1 : -1);
    return result ?? { error: VOTE_FAILED };
  } catch {
    return { error: VOTE_FAILED };
  }
}

export type ApproveState = { error?: string };

const APPROVE_FAILED = "Couldn't approve the idea. Please try again.";
const MOVE_BACK_FAILED = "Couldn't move the idea back. Please try again.";

// Approve and Move back: any member. A false result (not a member, already done, no such
// idea) changes nothing and says nothing; the page redraws either way. Only a failed save
// (the database could not be reached) shows a message.
export async function approveAction(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  const user = await getCurrentUser();
  const tripId = readId(formData, "tripId");
  const ideaId = readId(formData, "ideaId");
  if (tripId === "" || ideaId === "") return {};
  try {
    await approveIdea(tripId, ideaId, user.id);
  } catch {
    return { error: APPROVE_FAILED };
  }
  revalidatePath(listAddress(tripId));
  return {};
}

export async function moveBackAction(_prev: ApproveState, formData: FormData): Promise<ApproveState> {
  const user = await getCurrentUser();
  const tripId = readId(formData, "tripId");
  const ideaId = readId(formData, "ideaId");
  if (tripId === "" || ideaId === "") return {};
  try {
    await unapproveIdea(tripId, ideaId, user.id);
  } catch {
    return { error: MOVE_BACK_FAILED };
  }
  revalidatePath(listAddress(tripId));
  return {};
}
