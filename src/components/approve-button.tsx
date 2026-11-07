"use client";

import { useActionState } from "react";
import { ArrowUUpLeft, Check } from "@phosphor-icons/react";
import {
  approveAction,
  moveBackAction,
  type ApproveState,
} from "@/app/trips/[tripId]/ideas/actions";
import { smallQuietButton } from "@/components/ui";

const initialState: ApproveState = {};

// Approve, or Move back on an approved idea. The page redraws when it works; if the save
// fails, the message shows under the button the same way a failed vote does.
export function ApproveButton({
  tripId,
  ideaId,
  approved,
}: {
  tripId: string;
  ideaId: string;
  approved: boolean;
}) {
  const [state, formAction] = useActionState(approved ? moveBackAction : approveAction, initialState);

  return (
    <form action={formAction} className="grid gap-1">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="ideaId" value={ideaId} />
      <button type="submit" className={smallQuietButton}>
        {approved ? (
          <ArrowUUpLeft size={18} weight="bold" aria-hidden="true" />
        ) : (
          <Check size={18} weight="bold" aria-hidden="true" />
        )}
        {approved ? "Move back" : "Approve"}
      </button>
      <p aria-live="polite" className="text-[13px] font-bold text-owe empty:hidden">
        {state.error}
      </p>
    </form>
  );
}
