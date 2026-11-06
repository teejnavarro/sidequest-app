"use client";

import { useActionState, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { createTripAction, updateTripAction } from "@/app/trips/actions";
import type { TripFormState, TripFormValues } from "@/lib/trip-form-state";
import { formatTripDates, isCalendarDay } from "@/lib/trip-dates";
import { CURRENCIES, TIME_ZONES, TIME_ZONE_GROUPS } from "@/lib/trip-options";
import { RouteLine } from "@/components/route-line";
import {
  errorClass,
  helpClass,
  inputClass,
  labelClass,
  primaryButton,
  selectClass,
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4 border-0 p-0">
      <legend className="mb-3 p-0 font-display text-[17px] font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

// A dropdown with its own arrow, so the text lines up with the other boxes.
function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <CaretDown
        size={18}
        weight="bold"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

function describedBy(id: string, error?: string, help?: string) {
  return [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
}

const placeholder = "placeholder:text-muted";

// One form for both creating and editing a trip. After an error the server sends
// back what was typed, so nothing jumps back to empty.
export function TripForm(props: TripFormProps) {
  const action = props.mode === "create" ? createTripAction : updateTripAction;
  const initial: TripFormState = { errors: {}, values: props.values };
  const [state, formAction, pending] = useActionState(action, initial);
  const { errors, values } = state;

  // The two dates, tracked only to draw the route line. The inputs stay uncontrolled.
  const [start, setStart] = useState(props.values.startDate);
  const [end, setEnd] = useState(props.values.endDate);
  const showRoute = isCalendarDay(start) && isCalendarDay(end) && end >= start;
  const route = showRoute ? formatTripDates(start, end) : null;

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {props.mode === "edit" ? (
        <input type="hidden" name="tripId" value={props.tripId} />
      ) : null}

      <Group title="The trip">
        <Field id="name" label="Trip name" error={errors.name}>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={values.name}
            placeholder="Siargao with the org"
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name", errors.name)}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>

        <Field id="destination" label="Where to? (optional)" error={errors.destination}>
          <input
            id="destination"
            name="destination"
            type="text"
            defaultValue={values.destination}
            placeholder="Siargao"
            autoComplete="off"
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby={describedBy("destination", errors.destination)}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>
      </Group>

      <Group title="When">
        <div className="grid gap-3 min-[360px]:grid-cols-2">
          <Field id="startDate" label="Leaving" error={errors.startDate}>
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={values.startDate}
              onChange={(event) => setStart(event.target.value)}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={describedBy("startDate", errors.startDate)}
              className={`${inputClass} min-w-0`}
            />
          </Field>

          <Field id="endDate" label="Back" error={errors.endDate}>
            <input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={values.endDate}
              onChange={(event) => setEnd(event.target.value)}
              aria-invalid={errors.endDate ? true : undefined}
              aria-describedby={describedBy("endDate", errors.endDate)}
              className={`${inputClass} min-w-0`}
            />
          </Field>
        </div>

        {route ? (
          <div className="rounded-field bg-blue-soft px-3.5 py-3 text-blue-text">
            <RouteLine start={route.start} end={route.end} />
          </div>
        ) : null}
      </Group>

      <Group title="Details">
        <Field
          id="timeZone"
          label="Time zone"
          help="Times in the plan use this place's clock."
          error={errors.timeZone}
        >
          <SelectBox>
            <select
              id="timeZone"
              name="timeZone"
              defaultValue={values.timeZone}
              aria-invalid={errors.timeZone ? true : undefined}
              aria-describedby={describedBy("timeZone", errors.timeZone, "help")}
              className={selectClass}
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
          </SelectBox>
        </Field>

        <Field
          id="currency"
          label="Main currency"
          help="Costs are added up in this currency."
          error={errors.currency}
        >
          <SelectBox>
            <select
              id="currency"
              name="currency"
              defaultValue={values.currency}
              aria-invalid={errors.currency ? true : undefined}
              aria-describedby={describedBy("currency", errors.currency, "help")}
              className={selectClass}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </SelectBox>
        </Field>
      </Group>

      <p role="alert" className={`${errorClass} empty:hidden`}>
        {errors.form}
      </p>

      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : props.mode === "create" ? "Create trip" : "Save changes"}
      </button>
    </form>
  );
}
