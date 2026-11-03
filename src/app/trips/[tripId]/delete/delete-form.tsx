"use client";

import { useActionState } from "react";
import { deleteTripAction, type DeleteTripState } from "@/app/trips/actions";
import { dangerButton, errorClass } from "@/components/ui";

const initialState: DeleteTripState = {};

export function DeleteForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(deleteTripAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <button type="submit" disabled={pending} className={`${dangerButton} w-full`}>
        {pending ? "Deleting…" : "Delete trip"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
