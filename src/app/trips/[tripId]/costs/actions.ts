"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { deleteImages, putImage } from "@/lib/blob-store";
import { readJpegUpload } from "@/lib/image-file";
import { validateCostInput } from "@/lib/cost-input";
import {
  buildCostReview,
  CHANGED_NOTICE,
  photoActionOf,
  valuesFromCost,
  type CostFormState,
  type CostFormValues,
  type CostPhotoState,
  type DeleteCostState,
} from "@/lib/cost-form-state";
import {
  createCost,
  deleteCost,
  getCostForMember,
  restoreCost,
  setCostPhotoForMember,
  updateCost,
  type CostDetails,
} from "@/lib/costs";
import { firstNameOf } from "@/lib/display-name";
import { getTripForMember, listCostPeople } from "@/lib/trips";

// Only these named fields are ever read from the form, plus the trip and cost ids, the mode,
// the step and the time the cost was opened. Anything else a visitor adds is never looked at,
// and the hidden fields of the review are never trusted: Save checks the cost and works out
// the split again from the named fields. The ids only say WHICH trip or cost: who may add,
// change or delete is decided inside the database query, not here.
function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readValues(formData: FormData): CostFormValues {
  const sharedBy = formData.getAll("sharedBy").filter((value): value is string => typeof value === "string");
  return {
    description: readText(formData, "description"),
    amount: readText(formData, "amount"),
    paidBy: readText(formData, "paidBy"),
    sharedBy,
    spentOn: readText(formData, "spentOn"),
    category: readText(formData, "category"),
    split: readText(formData, "split") === "items" ? "items" : "equal",
    own: readOwn(formData, sharedBy),
    currency: readText(formData, "currency"),
    fx: readText(formData, "fx") === "charged" ? "charged" : "rate",
    rate: readText(formData, "rate"),
    charged: readText(formData, "charged"),
  };
}

// Only own:<spotId> boxes for people ticked in Split between are read; everything else is
// ignored. Whether the amounts are right is decided by validateCostInput.
function readOwn(formData: FormData, sharedBy: string[]): Record<string, string> {
  const own: Record<string, string> = {};
  for (const spotId of sharedBy) own[spotId] = readText(formData, `own:${spotId}`);
  return own;
}

// The form makes the cost's id (crypto.randomUUID), so a double tap saves once. This is a
// shape check only; who may save is decided in the query.
const COST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listAddress = (tripId: string) => `/trips/${tripId}/costs`;
const SAVE_FAILED = "Couldn't save the cost. Please try again.";
const DELETE_FAILED = "Couldn't delete the cost. Please try again.";
const RESTORE_FAILED = "Couldn't restore the cost. Please try again.";
const UPLOAD_FAILED = "Couldn't upload that image. Please try again.";
const PHOTO_FAILED = "Couldn't add the photo. Try again with a smaller picture or better signal.";

// What the person sees again after a stale save: the cost as it is now.
function changedState(current: CostDetails): CostFormState {
  return {
    errors: {},
    values: valuesFromCost(current),
    review: null,
    notice: CHANGED_NOTICE,
    updatedAt: current.updatedAt.toISOString(),
  };
}

// "Review" shows what will be saved; "Save" saves it. Both check the cost from scratch.
// Returns the state to show again, "done" once a new cost is saved, "edited" once an edit is
// saved (it ends at that cost's page), or "gone" for a trip or cost the person can't reach
// (they end up at the Costs tab).
async function reviewOrSave(
  userId: string,
  formData: FormData,
  tripId: string,
  costId: string,
): Promise<CostFormState | "done" | "edited" | "gone"> {
  const values = readValues(formData);
  const token = readText(formData, "updatedAt");
  const editing = readText(formData, "mode") === "edit";
  const saving = readText(formData, "step") === "save";

  const trip = await getTripForMember(tripId, userId);
  if (!trip) return "gone";
  // A person who left is listed only when editing a cost they are in.
  const members = await listCostPeople(tripId, userId, editing ? costId : null);
  const people = members.map((m) => ({ spotId: m.spotId, name: firstNameOf(m.name), isYou: m.id === userId }));

  const result = validateCostInput(values, {
    currency: trip.currency,
    spotIds: members.map((member) => member.spotId),
    names: Object.fromEntries(people.map((p) => [p.spotId, p.isYou ? "You" : p.name])),
  });
  if (!result.ok) {
    return { errors: result.errors, values, review: null, notice: null, updatedAt: token };
  }

  // The photo: what the form says to do, and a picked file checked (never uploaded) on both steps.
  const photo = photoActionOf(readText(formData, "photoAction"));
  let upload: Uint8Array | null = null;
  if (photo === "replace") {
    const checkedFile = await readJpegUpload(formData.get("photo"));
    if (!checkedFile.ok) return { errors: { form: checkedFile.error }, values, review: null, notice: null, updatedAt: token };
    upload = checkedFile.bytes;
  }

  if (!editing) {
    if (!saving) {
      const review = buildCostReview({ currency: trip.currency, input: result.value, people, before: null, photo });
      return { errors: {}, values, review, notice: null, updatedAt: token };
    }
    const newPath = await uploadPhoto(upload);
    if (newPath === "failed") return { errors: { form: UPLOAD_FAILED }, values, review: null, notice: null, updatedAt: token };
    let outcome: Awaited<ReturnType<typeof createCost>>;
    try {
      outcome = await createCost(tripId, userId, costId, result.value, newPath ? { set: newPath } : "keep");
    } catch (problem) {
      if (newPath) await deleteImages([newPath]);
      throw problem;
    }
    // Not in the trip or a repeat of the same save: the new file was not used, so delete it.
    if (outcome !== "ok" && newPath) await deleteImages([newPath]);
    return "done";
  }

  const expected = new Date(token);
  if (saving) {
    if (Number.isNaN(expected.getTime())) return "gone";
    const newPath = await uploadPhoto(upload);
    if (newPath === "failed") return { errors: { form: UPLOAD_FAILED }, values, review: null, notice: null, updatedAt: token };
    const change = newPath ? { set: newPath } : photo === "remove" ? ("remove" as const) : ("keep" as const);
    let outcome: Awaited<ReturnType<typeof updateCost>>;
    try {
      outcome = await updateCost(tripId, costId, userId, result.value, expected, change);
    } catch (problem) {
      if (newPath) await deleteImages([newPath]);
      throw problem;
    }
    if (typeof outcome === "object") {
      // Saved: the file it replaced or removed is no longer used.
      if (change !== "keep" && outcome.oldPhoto) await deleteImages([outcome.oldPhoto]);
      return "edited";
    }
    if (newPath) await deleteImages([newPath]);
    if (outcome === "not-found") return "gone";
    const current = await getCostForMember(tripId, costId, userId);
    return current ? changedState(current) : "gone";
  }

  const current = await getCostForMember(tripId, costId, userId);
  if (!current) return "gone";
  // The "before" has to be what the person was looking at, so a cost saved since is refused here too.
  if (Number.isNaN(expected.getTime()) || expected.getTime() !== current.updatedAt.getTime()) {
    return changedState(current);
  }
  const review = buildCostReview({ currency: trip.currency, input: result.value, people, before: current, photo });
  return { errors: {}, values, review, notice: null, updatedAt: token };
}

// Puts a checked photo in the private store: the new path, null when there is none, or "failed".
// The review step never calls this: only Save uploads.
async function uploadPhoto(upload: Uint8Array | null): Promise<string | null | "failed"> {
  if (!upload) return null;
  try {
    return await putImage("cost-photos", upload);
  } catch {
    return "failed";
  }
}

export async function reviewOrSaveCostAction(
  _prev: CostFormState,
  formData: FormData,
): Promise<CostFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readText(formData, "tripId");
  if (tripId === "") redirect("/trips");
  const costId = readText(formData, "costId");
  if (!COST_ID.test(costId)) redirect(listAddress(tripId));

  let outcome: CostFormState | "done" | "edited" | "gone";
  try {
    outcome = await reviewOrSave(user.id, formData, tripId, costId);
  } catch {
    return {
      errors: { form: SAVE_FAILED },
      values: readValues(formData),
      review: null,
      notice: null,
      updatedAt: readText(formData, "updatedAt"),
    };
  }

  if (outcome === "edited") {
    const address = `${listAddress(tripId)}/${costId}`;
    revalidatePath(listAddress(tripId));
    revalidatePath(address);
    redirect(address); // an edit returns to the cost's page
  }
  if (outcome === "done" || outcome === "gone") {
    if (outcome === "done") revalidatePath(listAddress(tripId));
    redirect(listAddress(tripId)); // redirect works by throwing: keep it outside try/catch
  }
  return outcome;
}

// The Cost page's "Add photo" box: checks the file, stores it, puts it on the cost, and deletes
// whichever file is no longer used. Only a current member can; the path never comes from the form.
export async function addCostPhotoAction(_prev: CostPhotoState, formData: FormData): Promise<CostPhotoState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const costId = readText(formData, "costId");
  if (tripId === "") redirect("/trips");
  if (costId === "") redirect(listAddress(tripId));

  const upload = await readJpegUpload(formData.get("photo"));
  if (!upload.ok) return { error: PHOTO_FAILED };
  let path: string;
  try {
    path = await putImage("cost-photos", upload.bytes);
  } catch {
    return { error: PHOTO_FAILED };
  }
  let saved: Awaited<ReturnType<typeof setCostPhotoForMember>>;
  try {
    saved = await setCostPhotoForMember(tripId, costId, user.id, path);
  } catch {
    await deleteImages([path]);
    return { error: PHOTO_FAILED };
  }
  if (!saved.ok) {
    await deleteImages([path]);
    return { error: PHOTO_FAILED };
  }
  if (saved.old) await deleteImages([saved.old]);
  revalidatePath(listAddress(tripId));
  revalidatePath(`${listAddress(tripId)}/${costId}`);
  return {};
}

export async function deleteCostAction(
  _prev: DeleteCostState,
  formData: FormData,
): Promise<DeleteCostState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const costId = readText(formData, "costId");
  if (tripId === "") redirect("/trips");
  if (costId === "") redirect(listAddress(tripId));

  try {
    await deleteCost(tripId, costId, user.id);
  } catch {
    return { error: DELETE_FAILED };
  }

  revalidatePath(listAddress(tripId));
  redirect(listAddress(tripId));
}

// Puts a trashed cost back. Like delete, it reads only the two ids, and it ends on the Costs
// tab even when nothing was restored (someone else got there first).
export async function restoreCostAction(
  _prev: DeleteCostState,
  formData: FormData,
): Promise<DeleteCostState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const costId = readText(formData, "costId");
  if (tripId === "") redirect("/trips");
  if (costId === "") redirect(listAddress(tripId));

  try {
    await restoreCost(tripId, costId, user.id);
  } catch {
    return { error: RESTORE_FAILED };
  }

  revalidatePath(listAddress(tripId));
  redirect(listAddress(tripId));
}
