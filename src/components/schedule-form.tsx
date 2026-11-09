"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  addToScheduleAction,
  moveScheduleItemAction,
} from "@/app/trips/[tripId]/schedule/actions";
import { ChoiceChips, Field, describedBy } from "@/components/form-fields";
import { IdeaTypeIcon } from "@/components/idea-type";
import {
  errorClass,
  focusRing,
  inputClass,
  labelClass,
  linkClass,
  primaryButton,
} from "@/components/ui";
import type { ScheduleFormState, ScheduleFormValues } from "@/lib/schedule-form-state";
import type { ApprovedIdea } from "@/lib/schedule";
import { SLOTS, type TripDay } from "@/lib/schedule-options";

type ScheduleFormProps = {
  tripId: string;
  // Which kind of item this is: an approved idea, or something new with its own name.
  kind: "idea" | "new";
  days: TripDay[];
  // The place whose clock exact times use, such as "Vietnam".
  place: string | null;
  values: ScheduleFormValues;
} & (
  | { mode: "add"; ideas: ApprovedIdea[] }
  | { mode: "move"; itemId: string }
);

const placeholder = "placeholder:text-muted";

// The approved ideas you can put on the schedule, one tap each. Real radio buttons drawn as
// rows, so the keyboard and screen readers work.
function IdeaPicker({
  ideas,
  value,
  error,
}: {
  ideas: ApprovedIdea[];
  value: string;
  error?: string;
}) {
  return (
    <fieldset
      className="grid min-w-0 gap-2 border-0 p-0"
      aria-describedby={error ? "ideaId-error" : undefined}
    >
      <legend className={`${labelClass} mb-1.5 p-0`}>Pick an approved idea</legend>
      {ideas.map((idea) => (
        <label key={idea.id} className="relative block">
          <input
            type="radio"
            name="ideaId"
            value={idea.id}
            defaultChecked={value === idea.id}
            className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span className="flex min-h-12 items-center gap-2 rounded-field border border-line bg-card px-3.5 py-2 text-[15px] font-bold peer-checked:border-blue-text peer-checked:bg-blue-soft peer-checked:text-blue-text peer-checked:ring-2 peer-checked:ring-blue-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-text">
            <IdeaTypeIcon type={idea.type} />
            <span className="min-w-0 wrap-anywhere">{idea.name}</span>
          </span>
        </label>
      ))}
      {error ? (
        <span id="ideaId-error" className={errorClass}>
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}

// One form for adding to the schedule and for moving an item. After an error the server
// sends back what was typed and chosen, so nothing jumps back to empty.
export function ScheduleForm(props: ScheduleFormProps) {
  const action = props.mode === "add" ? addToScheduleAction : moveScheduleItemAction;
  const initial: ScheduleFormState = { errors: {}, values: props.values };
  const [state, formAction, pending] = useActionState(action, initial);
  const { errors, values } = state;
  // The main button names the day once one is picked.
  const [day, setDay] = useState(props.values.day);
  const dayLabel = props.days.find((option) => option.day === day)?.label;

  if (props.mode === "add" && props.kind === "idea" && props.ideas.length === 0) {
    return (
      <div className="grid gap-3">
        <p>No approved ideas yet. Approve some on the Ideas tab.</p>
        <Link href={`/trips/${props.tripId}/ideas`} className={`${linkClass} justify-self-start font-bold text-blue-text`}>
          Go to Ideas
        </Link>
      </div>
    );
  }

  const submitLabel = pending
    ? "Saving…"
    : props.mode === "move"
      ? "Save changes"
      : dayLabel
        ? `Add to ${dayLabel}`
        : "Add to schedule";

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      <input type="hidden" name="tripId" value={props.tripId} />
      <input type="hidden" name="kind" value={props.kind} />
      {props.mode === "move" ? <input type="hidden" name="itemId" value={props.itemId} /> : null}

      <div className="grid gap-5">
        {props.mode === "add" && props.kind === "idea" ? (
          <IdeaPicker ideas={props.ideas} value={values.ideaId} error={errors.ideaId} />
        ) : null}

        {props.kind === "new" ? (
          <Field id="name" label="Name" error={errors.name}>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={values.name}
              placeholder="Airport transfer"
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name", errors.name)}
              className={`${inputClass} ${placeholder}`}
            />
          </Field>
        ) : null}

        <ChoiceChips
          name="day"
          legend="Which day?"
          options={props.days.map((option) => ({ value: option.day, label: option.short }))}
          value={values.day}
          error={errors.day}
          onChange={setDay}
        />

        {/* The time box appears only when Exact time is chosen. It is plain CSS, so it works
            without JavaScript too. */}
        <div className="group grid min-w-0 gap-5">
          <ChoiceChips
            name="slot"
            legend="When?"
            options={SLOTS}
            value={values.slot}
            error={errors.slot}
          />
          <div className="hidden group-has-[input[name=slot][value=time]:checked]:grid">
            <Field
              id="time"
              label={props.place ? `Time (${props.place} time)` : "Time"}
              error={errors.time}
            >
              <input
                id="time"
                name="time"
                type="time"
                defaultValue={values.time}
                aria-invalid={errors.time ? true : undefined}
                aria-describedby={describedBy("time", errors.time)}
                className={`${inputClass} ${placeholder} sm:w-48`}
              />
            </Field>
          </div>
        </div>

        {props.kind === "new" ? (
          <Field id="notes" label="Notes (optional)" error={errors.notes}>
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
        ) : null}
      </div>

      <p role="alert" className={`${errorClass} empty:hidden`}>
        {errors.form}
      </p>

      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {submitLabel}
      </button>
    </form>
  );
}
