"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import {
  addIdeaToSchedule,
  addNewItem,
  getScheduleItemForMember,
  moveScheduleItem,
  removeScheduleItem,
} from "@/lib/schedule";
import { validateScheduleInput } from "@/lib/schedule-input";
import { tripDays } from "@/lib/schedule-options";
import type { ScheduleFormState, ScheduleFormValues } from "@/lib/schedule-form-state";

// Only these named fields are ever read from the form, plus the trip and item ids. Anything
// else a visitor adds (an updatedBy, say) is never looked at. The ids only say WHICH trip or
// item: who may add, move or remove is decided inside the database query, not here.
function readValues(formData: FormData): ScheduleFormValues {
  const text = (key: keyof ScheduleFormValues) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    kind: text("kind"),
    ideaId: text("ideaId"),
    name: text("name"),
    notes: text("notes"),
    day: text("day"),
    slot: text("slot"),
    time: text("time"),
  };
}

function readId(formData: FormData, key: "tripId" | "itemId"): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const scheduleAddress = (tripId: string) => `/trips/${tripId}/schedule`;
const dayAddress = (tripId: string, day: string) => `${scheduleAddress(tripId)}#day-${day}`;
const SAVE_FAILED = "Couldn't save the schedule. Please try again.";

// The Schedule and Ideas tabs both change when something is added, moved or removed.
function refresh(tripId: string) {
  revalidatePath(scheduleAddress(tripId));
  revalidatePath(`/trips/${tripId}/ideas`);
}

export async function addToScheduleAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readId(formData, "tripId");
  if (tripId === "") redirect("/trips");

  const values = readValues(formData);
  let target = scheduleAddress(tripId);
  try {
    const trip = await getTripForMember(tripId, user.id);
    // A person who is not in the trip adds nothing; the same redirect follows either way.
    if (trip) {
      const result = validateScheduleInput(
        values,
        tripDays(trip.startDate, trip.endDate).map((d) => d.day),
      );
      if (!result.ok) return { errors: result.errors, values };
      if (result.value.kind === "idea") {
        await addIdeaToSchedule(tripId, user.id, result.value);
      } else {
        await addNewItem(tripId, user.id, result.value);
      }
      target = dayAddress(tripId, result.value.day);
    }
  } catch {
    return { errors: { form: SAVE_FAILED }, values };
  }

  refresh(tripId);
  redirect(target); // redirect works by throwing: keep it outside try/catch
}

export async function moveScheduleItemAction(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const user = await getCurrentUser();

  const tripId = readId(formData, "tripId");
  const itemId = readId(formData, "itemId");
  if (tripId === "") redirect("/trips");
  if (itemId === "") redirect(scheduleAddress(tripId));

  const typed = readValues(formData);
  let target = scheduleAddress(tripId);
  try {
    const [trip, item] = await Promise.all([
      getTripForMember(tripId, user.id),
      getScheduleItemForMember(tripId, itemId, user.id),
    ]);
    // Not in the trip, or no such item: nothing changes, and the page shows the schedule.
    if (trip && item) {
      // The kind comes from the saved item, never from the form.
      const values = { ...typed, kind: item.fromIdea ? "idea" : "new", ideaId: item.ideaId ?? "" };
      const result = validateScheduleInput(
        values,
        tripDays(trip.startDate, trip.endDate).map((d) => d.day),
      );
      if (!result.ok) return { errors: result.errors, values: typed };
      await moveScheduleItem(tripId, itemId, user.id, result.value);
      target = dayAddress(tripId, result.value.day);
    }
  } catch {
    return { errors: { form: SAVE_FAILED }, values: typed };
  }

  refresh(tripId);
  redirect(target);
}

export type RemoveScheduleItemState = { error?: string };

// Takes an item off the schedule. For an idea item that sends the idea back to Approved; for
// a new item it deletes it for good. Repeating it is harmless.
export async function removeScheduleItemAction(
  _prev: RemoveScheduleItemState,
  formData: FormData,
): Promise<RemoveScheduleItemState> {
  const user = await getCurrentUser();

  const tripId = readId(formData, "tripId");
  const itemId = readId(formData, "itemId");
  if (tripId === "") redirect("/trips");
  if (itemId === "") redirect(scheduleAddress(tripId));

  let address = scheduleAddress(tripId);
  try {
    // Read first only to know which day to return to.
    const item = await getScheduleItemForMember(tripId, itemId, user.id);
    if (item) address = dayAddress(tripId, item.day);
    await removeScheduleItem(tripId, itemId, user.id);
  } catch {
    return { error: SAVE_FAILED };
  }

  refresh(tripId);
  redirect(address);
}
