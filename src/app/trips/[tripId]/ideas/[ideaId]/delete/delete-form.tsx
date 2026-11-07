"use client";

import { useActionState } from "react";
import { deleteIdeaAction, type DeleteIdeaState } from "../../actions";
import { dangerButton, errorClass } from "@/components/ui";

const initialState: DeleteIdeaState = {};

export function DeleteIdeaForm({ tripId, ideaId }: { tripId: string; ideaId: string }) {
  const [state, formAction, pending] = useActionState(deleteIdeaAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="ideaId" value={ideaId} />
      <button type="submit" disabled={pending} className={`${dangerButton} w-full`}>
        {pending ? "Deleting…" : "Delete idea"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
