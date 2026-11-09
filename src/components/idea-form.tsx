"use client";

import { useActionState } from "react";
import { createIdeaAction, updateIdeaAction } from "@/app/trips/[tripId]/ideas/actions";
import type { IdeaFormState, IdeaFormValues } from "@/lib/idea-form-state";
import { DURATIONS, IDEA_TYPES, currencySymbol } from "@/lib/idea-options";
import { ChoiceChips, Field, describedBy } from "@/components/form-fields";
import {
  errorClass,
  focusRing,
  inputClass,
  primaryButton,
} from "@/components/ui";

type IdeaFormProps =
  | { mode: "create"; tripId: string; currency: string; values: IdeaFormValues }
  | { mode: "edit"; tripId: string; ideaId: string; currency: string; values: IdeaFormValues };

const placeholder = "placeholder:text-muted";

// One form for adding and editing an idea. After an error the server sends back what was
// typed and chosen, so nothing jumps back to empty.
export function IdeaForm(props: IdeaFormProps) {
  const action = props.mode === "create" ? createIdeaAction : updateIdeaAction;
  const initial: IdeaFormState = { errors: {}, values: props.values };
  const [state, formAction, pending] = useActionState(action, initial);
  const { errors, values } = state;

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <input type="hidden" name="tripId" value={props.tripId} />
      {props.mode === "edit" ? <input type="hidden" name="ideaId" value={props.ideaId} /> : null}

      <div className="grid gap-5">
        <Field id="name" label="What's the idea?" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={values.name}
            placeholder="Bánh mì Huỳnh Hoa"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name", errors.name)}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>

        <ChoiceChips
          name="type"
          legend="Type"
          options={IDEA_TYPES.map((type) => ({ value: type.value, label: type.label, icon: true }))}
          value={values.type}
          error={errors.type}
        />

        <ChoiceChips
          name="duration"
          legend="How long?"
          options={DURATIONS}
          value={values.duration}
          error={errors.duration}
        />
      </div>

      <fieldset className="grid min-w-0 gap-5 border-0 p-0">
        <legend className="mb-3 p-0 font-display text-[17px] font-bold">Optional</legend>

        <Field
          id="link"
          label="Google Maps link"
          help="Share the place in Google Maps, then copy the link. It pins down the exact spot."
          error={errors.link}
        >
          <input
            id="link"
            name="link"
            type="url"
            inputMode="url"
            defaultValue={values.link}
            placeholder="Paste it from Google Maps"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.link ? true : undefined}
            aria-describedby={describedBy("link", errors.link, "help")}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>

        <Field id="area" label="Area" error={errors.area}>
          <input
            id="area"
            name="area"
            type="text"
            defaultValue={values.area}
            placeholder="District 1"
            autoComplete="off"
            aria-invalid={errors.area ? true : undefined}
            aria-describedby={describedBy("area", errors.area)}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>

        <Field
          id="costPerPerson"
          label="Cost per person"
          help="A rough guess is fine."
          error={errors.costPerPerson}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="min-w-6 text-base font-bold text-muted">
              {currencySymbol(props.currency)}
            </span>
            <input
              id="costPerPerson"
              name="costPerPerson"
              type="text"
              inputMode="numeric"
              defaultValue={values.costPerPerson}
              placeholder="120"
              autoComplete="off"
              aria-invalid={errors.costPerPerson ? true : undefined}
              aria-describedby={describedBy("costPerPerson", errors.costPerPerson, "help")}
              className={`${inputClass} ${placeholder} flex-1`}
            />
          </div>
        </Field>

        <Field id="notes" label="Notes" error={errors.notes}>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={values.notes}
            placeholder="Anything the group should know"
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={describedBy("notes", errors.notes)}
            className={`${inputClass} ${placeholder} min-h-24 resize-y py-3 ${focusRing}`}
          />
        </Field>
      </fieldset>

      <p role="alert" className={`${errorClass} empty:hidden`}>
        {errors.form}
      </p>

      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : props.mode === "create" ? "Add idea" : "Save changes"}
      </button>
    </form>
  );
}
