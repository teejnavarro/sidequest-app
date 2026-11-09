"use client";

import { useActionState } from "react";
import {
  removeScheduleItemAction,
  type RemoveScheduleItemState,
} from "@/app/trips/[tripId]/schedule/actions";
import { dangerButton, errorClass, quietButton } from "@/components/ui";

const initialState: RemoveScheduleItemState = {};

// A button that takes one schedule item off the schedule: "Back to approved ideas" for an
// idea (quiet) or "Delete item" for something new (red). The server decides who may do it.
export function RemoveItemForm({
  tripId,
  itemId,
  label,
  pendingLabel,
  danger = false,
}: {
  tripId: string;
  itemId: string;
  label: string;
  pendingLabel: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(removeScheduleItemAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="itemId" value={itemId} />
      <button type="submit" disabled={pending} className={`${danger ? dangerButton : quietButton} w-full`}>
        {pending ? pendingLabel : label}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
