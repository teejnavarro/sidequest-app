"use client";

import { useActionState } from "react";
import {
  createTripAction,
  updateTripAction,
} from "@/app/trips/actions";
import type { TripFormState, TripFormValues } from "@/lib/trip-form-state";
import { CURRENCIES, TIME_ZONES, TIME_ZONE_GROUPS } from "@/lib/trip-options";
import {
  errorClass,
  helpClass,
  inputClass,
  labelClass,
  primaryButton,
} from "@/components/ui";

type TripFormProps =
  | { mode: "create"; values: TripFormValues }
  | { mode: "edit"; values: TripFormValues; tripId: string };

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
};

function Field({ id, label, error, help, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
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

function describedBy(id: string, error?: string, help?: string) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
}

// One form for both creating and editing a trip. After an error the server sends
// back what was typed, so nothing jumps back to empty.
export function TripForm(props: TripFormProps) {
  const action = props.mode === "create" ? createTripAction : updateTripAction;
  const initial: TripFormState = { errors: {}, values: props.values };
  const [state, formAction, pending] = useActionState(action, initial);
  const { errors, values } = state;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {props.mode === "edit" ? (
        <input type="hidden" name="tripId" value={props.tripId} />
      ) : null}

      <Field id="name" label="Trip name" error={errors.name}>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={values.name}
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("name", errors.name)}
          className={inputClass}
        />
      </Field>

      <Field id="destination" label="Destination (optional)" error={errors.destination}>
        <input
          id="destination"
          name="destination"
          type="text"
          defaultValue={values.destination}
          autoComplete="off"
          aria-invalid={errors.destination ? true : undefined}
          aria-describedby={describedBy("destination", errors.destination)}
          className={inputClass}
        />
      </Field>

      <Field id="startDate" label="Start date" error={errors.startDate}>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={values.startDate}
          aria-invalid={errors.startDate ? true : undefined}
          aria-describedby={describedBy("startDate", errors.startDate)}
          className={inputClass}
        />
      </Field>

      <Field id="endDate" label="End date" error={errors.endDate}>
        <input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          aria-invalid={errors.endDate ? true : undefined}
          aria-describedby={describedBy("endDate", errors.endDate)}
          className={inputClass}
        />
      </Field>

      <Field
        id="timeZone"
        label="Time zone"
        help="The place the trip is in. Times in the plan use this."
        error={errors.timeZone}
      >
        <select
          id="timeZone"
          name="timeZone"
          defaultValue={values.timeZone}
          aria-invalid={errors.timeZone ? true : undefined}
          aria-describedby={describedBy("timeZone", errors.timeZone, "help")}
          className={inputClass}
        >
          {TIME_ZONE_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {TIME_ZONES.filter((zone) => zone.group === group).map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field
        id="currency"
        label="Main currency"
        help="Costs are added up in this currency."
        error={errors.currency}
      >
        <select
          id="currency"
          name="currency"
          defaultValue={values.currency}
          aria-invalid={errors.currency ? true : undefined}
          aria-describedby={describedBy("currency", errors.currency, "help")}
          className={inputClass}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label}
            </option>
          ))}
        </select>
      </Field>

      <p role="alert" className={`${errorClass} empty:hidden`}>
        {errors.form}
      </p>

      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : props.mode === "create" ? "Create trip" : "Save changes"}
      </button>
    </form>
  );
}
