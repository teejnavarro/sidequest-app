"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { validateTripInput } from "@/lib/trip-input";
import type { TripFormState, TripFormValues } from "@/lib/trip-form-state";
import { createTrip, deleteTripForOwner, updateTripForMember } from "@/lib/trips";

// Only these six fields are ever read from the form. Anything else a visitor
// adds (an ownerId, say) is never looked at.
function readValues(formData: FormData): TripFormValues {
  const text = (key: keyof TripFormValues) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    timeZone: text("timeZone"),
    currency: text("currency"),
    destination: text("destination"),
  };
}

export async function createTripAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const values = readValues(formData);
  const result = validateTripInput(values);
  if (!result.ok) return { errors: result.errors, values };

  let tripId: string;
  try {
    tripId = await createTrip(user.id, result.value);
  } catch {
    return {
      errors: { form: "Could not save the trip. Please try again." },
      values,
    };
  }

  revalidatePath("/trips");
  redirect(`/trips/${tripId}`); // redirect works by throwing: keep it outside try/catch
}

export async function updateTripAction(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const user = await getCurrentUser();

  const values = readValues(formData);
  const tripIdField = formData.get("tripId");
  const tripId = typeof tripIdField === "string" ? tripIdField : "";

  const result = validateTripInput(values);
  if (!result.ok) return { errors: result.errors, values };

  let saved: boolean;
  try {
    // Who may change this trip is decided only in here, never by the form.
    saved = tripId !== "" && (await updateTripForMember(tripId, user.id, result.value));
  } catch {
    return {
      errors: { form: "Could not save the trip. Please try again." },
      values,
    };
  }
  if (!saved) {
    return { errors: { form: "We couldn't find that trip." }, values };
  }

  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`, "layout");
  redirect(`/trips/${tripId}`);
}

export type DeleteTripState = { error?: string };

// Permanently deletes a trip, for its owner only. Whether or not a trip was removed, the
// person ends up on My trips: a repeated or forged request changes nothing and reveals
// nothing about which trips exist.
export async function deleteTripAction(
  _prev: DeleteTripState,
  formData: FormData,
): Promise<DeleteTripState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripIdField = formData.get("tripId");
  const tripId = typeof tripIdField === "string" ? tripIdField : "";
  if (tripId === "") redirect("/trips");

  try {
    // Who may delete is decided only in here, never by the form or by a hidden link.
    await deleteTripForOwner(tripId, user.id);
  } catch {
    return { error: "Could not delete the trip. Please try again." };
  }

  revalidatePath("/trips");
  redirect("/trips"); // redirect works by throwing: keep it outside try/catch
}
