"use client";

import { useActionState } from "react";
import { restoreCostAction } from "../actions";
import type { DeleteCostState } from "@/lib/cost-form-state";
import { errorClass, smallQuietButton } from "@/components/ui";

const initialState: DeleteCostState = {};

// One Restore button for one trashed cost. It asks nothing: nothing is lost either way.
export function RestoreCostForm({ tripId, costId }: { tripId: string; costId: string }) {
  const [state, formAction, pending] = useActionState(restoreCostAction, initialState);

  return (
    <form action={formAction} className="grid justify-items-start gap-1">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="costId" value={costId} />
      <button type="submit" disabled={pending} className={smallQuietButton}>
        {pending ? "Restoring…" : "Restore"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
