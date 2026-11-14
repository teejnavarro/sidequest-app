"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { validateCostInput } from "@/lib/cost-input";
import {
  buildCostReview,
  CHANGED_NOTICE,
  valuesFromCost,
  type CostFormState,
  type CostFormValues,
  type DeleteCostState,
} from "@/lib/cost-form-state";
import { createCost, deleteCost, getCostForMember, updateCost, type CostDetails } from "@/lib/costs";
import { firstNameOf } from "@/lib/display-name";
import { amountText } from "@/lib/money";
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
  return {
    description: readText(formData, "description"),
    amount: readText(formData, "amount"),
    paidBy: readText(formData, "paidBy"),
    sharedBy: formData.getAll("sharedBy").filter((value): value is string => typeof value === "string"),
    spentOn: readText(formData, "spentOn"),
    category: readText(formData, "category"),
  };
}

// The form makes the cost's id (crypto.randomUUID), so a double tap saves once. This is a
// shape check only; who may save is decided in the query.
const COST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const listAddress = (tripId: string) => `/trips/${tripId}/costs`;
const SAVE_FAILED = "Couldn't save the cost. Please try again.";
const DELETE_FAILED = "Couldn't delete the cost. Please try again.";

// What the person sees again after a stale save: the cost as it is now.
function changedState(current: CostDetails): CostFormState {
  return {
    errors: {},
    values: valuesFromCost(current, amountText(current.amount, current.currency)),
    review: null,
    notice: CHANGED_NOTICE,
    updatedAt: current.updatedAt.toISOString(),
  };
}

// "Review" shows what will be saved; "Save" saves it. Both check the cost from scratch.
// Returns the state to show again, "done" once saved, or "gone" for a trip or cost the
// person can't reach (they end up at the Costs tab either way).
async function reviewOrSave(
  userId: string,
  formData: FormData,
  tripId: string,
  costId: string,
): Promise<CostFormState | "done" | "gone"> {
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
  });
  if (!result.ok) {
    return { errors: result.errors, values, review: null, notice: null, updatedAt: token };
  }

  if (!editing) {
    if (!saving) {
      const review = buildCostReview({ currency: trip.currency, input: result.value, people, before: null });
      return { errors: {}, values, review, notice: null, updatedAt: token };
    }
    // Not in the trip or a repeat of the same save: nothing more to do either way.
    await createCost(tripId, userId, costId, result.value);
    return "done";
  }

  const expected = new Date(token);
  if (saving) {
    if (Number.isNaN(expected.getTime())) return "gone";
    const outcome = await updateCost(tripId, costId, userId, result.value, expected);
    if (outcome === "changed") {
      const current = await getCostForMember(tripId, costId, userId);
      return current ? changedState(current) : "gone";
    }
    return "done";
  }

  const current = await getCostForMember(tripId, costId, userId);
  if (!current) return "gone";
  // The "before" has to be what the person was looking at, so a cost saved since is refused here too.
  if (Number.isNaN(expected.getTime()) || expected.getTime() !== current.updatedAt.getTime()) {
    return changedState(current);
  }
  const review = buildCostReview({ currency: trip.currency, input: result.value, people, before: current });
  return { errors: {}, values, review, notice: null, updatedAt: token };
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

  let outcome: CostFormState | "done" | "gone";
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

  if (outcome === "done" || outcome === "gone") {
    if (outcome === "done") revalidatePath(listAddress(tripId));
    redirect(listAddress(tripId)); // redirect works by throwing: keep it outside try/catch
  }
  return outcome;
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
