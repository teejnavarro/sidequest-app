"use client";

import { useActionState } from "react";
import { deleteCostAction } from "../../actions";
import type { DeleteCostState } from "@/lib/cost-form-state";
import { dangerButton, errorClass } from "@/components/ui";

const initialState: DeleteCostState = {};

export function DeleteCostForm({ tripId, costId }: { tripId: string; costId: string }) {
  const [state, formAction, pending] = useActionState(deleteCostAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="costId" value={costId} />
      <button type="submit" disabled={pending} className={`${dangerButton} w-full`}>
        {pending ? "Deleting…" : "Delete cost"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
