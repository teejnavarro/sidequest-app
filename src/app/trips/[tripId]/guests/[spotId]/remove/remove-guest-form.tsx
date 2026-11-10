"use client";

import { useActionState } from "react";
import { removeGuestAction } from "../../actions";
import type { RemoveGuestState } from "@/lib/guest-form-state";
import { dangerButton, errorClass } from "@/components/ui";

const initialState: RemoveGuestState = {};

export function RemoveGuestForm({ tripId, spotId }: { tripId: string; spotId: string }) {
  const [state, formAction, pending] = useActionState(removeGuestAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="spotId" value={spotId} />
      <button type="submit" disabled={pending} className={`${dangerButton} w-full`}>
        {pending ? "Removing…" : "Remove guest"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
