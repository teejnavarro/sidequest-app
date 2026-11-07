"use client";

import { useActionState } from "react";
import { createIdeaAction, updateIdeaAction } from "@/app/trips/[tripId]/ideas/actions";
import type { IdeaFormState, IdeaFormValues } from "@/lib/idea-form-state";
import { DURATIONS, IDEA_TYPES, currencySymbol } from "@/lib/idea-options";
import { IdeaTypeIcon } from "@/components/idea-type";
import {
  errorClass,
  focusRing,
  helpClass,
  inputClass,
  labelClass,
  primaryButton,
} from "@/components/ui";

type IdeaFormProps =
  | { mode: "create"; tripId: string; currency: string; values: IdeaFormValues }
  | { mode: "edit"; tripId: string; ideaId: string; currency: string; values: IdeaFormValues };

const placeholder = "placeholder:text-muted";

function describedBy(id: string, error?: string, help?: string) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Field({
  id,
  label,
  error,
  help,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {help ? (
        <span id={`${id}-help`} className={helpClass}>
          {help}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className={errorClass}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

// A group of round choices where you pick one. They are real radio buttons, so the keyboard
// and screen readers work, drawn as chips. The choice stays after an error.
function ChoiceChips({
  name,
  legend,
  options,
  value,
  error,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string; icon?: boolean }[];
  value: string;
  error?: string;
}) {
  return (
    <fieldset
      className="grid min-w-0 gap-1.5 border-0 p-0"
      aria-describedby={error ? `${name}-error` : undefined}
    >
      <legend className={`${labelClass} mb-1.5 p-0`}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="peer absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-chip px-3.5 text-sm font-bold text-ink peer-checked:bg-blue-soft peer-checked:text-blue-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-text`}
            >
              {option.icon ? <IdeaTypeIcon type={option.value} /> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <span id={`${name}-error`} className={errorClass}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

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
