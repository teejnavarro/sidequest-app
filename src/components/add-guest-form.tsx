"use client";

import { useActionState } from "react";
import { addGuestAction } from "@/app/trips/[tripId]/guests/actions";
import { emptyGuestForm } from "@/lib/guest-form-state";
import { describedBy } from "@/components/form-fields";
import { errorClass, helpClass, inputClass, labelClass, smallQuietButton } from "@/components/ui";

// "Add a guest" under the people list on Invite people: a name and a quiet Add button.
export function AddGuestForm({ tripId }: { tripId: string }) {
  const [state, formAction, pending] = useActionState(addGuestAction, emptyGuestForm);

  return (
    <form action={formAction} className="grid gap-1.5 border-t border-line pt-4">
      <input type="hidden" name="tripId" value={tripId} />
      <h3 className={labelClass}>Add a guest</h3>
      <p id="guest-name-help" className={helpClass}>
        For friends who won&apos;t sign up. They can take over their spot later by joining with
        the link.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor="guest-name" className="sr-only">
            Guest&apos;s name
          </label>
          <input
            id="guest-name"
            name="name"
            type="text"
            autoComplete="off"
            placeholder="Guest's name"
            defaultValue={state.name}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={describedBy("guest-name", state.error, "help")}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={pending} className={`${smallQuietButton} min-h-12 px-5`}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p id="guest-name-error" role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
