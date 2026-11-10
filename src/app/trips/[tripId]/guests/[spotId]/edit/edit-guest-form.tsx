"use client";

import { useActionState } from "react";
import { renameGuestAction } from "../../actions";
import { emptyGuestForm } from "@/lib/guest-form-state";
import { Field, describedBy } from "@/components/form-fields";
import { inputClass, primaryButton } from "@/components/ui";

export function EditGuestForm({
  tripId,
  spotId,
  name,
}: {
  tripId: string;
  spotId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(renameGuestAction, {
    ...emptyGuestForm,
    name,
  });

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="spotId" value={spotId} />
      <Field id="guest-name" label="Name" error={state.error}>
        <input
          id="guest-name"
          name="name"
          type="text"
          autoComplete="off"
          defaultValue={state.name}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy("guest-name", state.error)}
          className={inputClass}
        />
      </Field>
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
