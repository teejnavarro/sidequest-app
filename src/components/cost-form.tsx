"use client";

import { useActionState, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import { reviewOrSaveCostAction } from "@/app/trips/[tripId]/costs/actions";
import type { CostFormState, CostFormValues, CostPerson } from "@/lib/cost-form-state";
import { COST_CATEGORIES } from "@/lib/cost-options";
import { currencySymbol } from "@/lib/idea-options";
import { minorDigits } from "@/lib/money";
import { CostReviewView } from "@/components/cost-review";
import { Face } from "@/components/face";
import { Field, describedBy } from "@/components/form-fields";
import {
  errorClass,
  guestTag,
  inputClass,
  labelClass,
  primaryButton,
  quietButton,
  selectClass,
} from "@/components/ui";

type CostFormProps = {
  mode: "new" | "edit";
  tripId: string;
  costId: string;
  currency: string;
  people: CostPerson[];
  values: CostFormValues;
  // When an edit was opened (an ISO string); empty for a new cost.
  updatedAt: string;
};

const placeholder = "placeholder:text-muted";

// A person as a round choice with their face: a real radio or checkbox underneath, so the
// keyboard and screen readers work. The ticked look also shows a check mark, not only color.
function PersonChoice({
  type,
  name,
  person,
  checked,
}: {
  type: "radio" | "checkbox";
  name: string;
  person: CostPerson;
  checked: boolean;
}) {
  return (
    <label className="relative">
      <input
        type={type}
        name={name}
        value={person.spotId}
        defaultChecked={checked}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
      />
      <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-chip py-1 pr-3.5 pl-1.5 text-sm font-bold text-ink peer-checked:bg-blue-soft peer-checked:text-blue-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-text peer-checked:[&_.tick]:inline">
        <Face
          userId={person.userId}
          name={person.name}
          image={person.image}
          size={28}
          decorative
          neutral={person.isGuest}
        />
        {person.isYou ? "You" : person.name}
        {person.isGuest ? <span className={guestTag}>Guest</span> : null}
        {person.hasLeft ? <span className={guestTag}>Left</span> : null}
        <Check size={14} weight="bold" aria-hidden="true" className="tick hidden" />
      </span>
    </label>
  );
}

// One form for logging and editing a cost. "Review" sends it to the server, which checks it
// and works out the split; the review then replaces the form, and "Save" sends it again so
// the server checks once more. After an error the server sends back what was typed.
export function CostForm(props: CostFormProps) {
  const initial: CostFormState = { errors: {}, values: props.values, review: null, notice: null, updatedAt: props.updatedAt };
  const [state, formAction, pending] = useActionState(reviewOrSaveCostAction, initial);
  // "Change something" hides the review again, without asking the server for anything.
  const [hiddenFor, setHiddenFor] = useState<CostFormState | null>(null);
  const { errors, values } = state;

  const hidden = (
    <>
      <input type="hidden" name="tripId" value={props.tripId} />
      <input type="hidden" name="costId" value={props.costId} />
      <input type="hidden" name="mode" value={props.mode} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
    </>
  );

  if (state.review && hiddenFor !== state) {
    return (
      <form action={formAction} className="grid gap-5">
        {hidden}
        <input type="hidden" name="step" value="save" />
        <input type="hidden" name="description" value={values.description} />
        <input type="hidden" name="amount" value={values.amount} />
        <input type="hidden" name="paidBy" value={values.paidBy} />
        {values.sharedBy.map((spotId) => (
          <input key={spotId} type="hidden" name="sharedBy" value={spotId} />
        ))}
        <input type="hidden" name="spentOn" value={values.spentOn} />
        <input type="hidden" name="category" value={values.category} />

        <CostReviewView review={state.review} />

        <div className="grid gap-3">
          <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
            {pending ? "Saving…" : props.mode === "new" ? "Save cost" : "Save changes"}
          </button>
          <button type="button" onClick={() => setHiddenFor(state)} className={`${quietButton} w-full`}>
            Change something
          </button>
        </div>
      </form>
    );
  }

  const decimals = minorDigits(props.currency) > 0;

  return (
    // A new key gives the boxes fresh values when the server sends back a newer copy.
    <form key={`${state.updatedAt}|${state.notice ?? ""}`} action={formAction} className="grid gap-6" noValidate>
      {hidden}
      <input type="hidden" name="step" value="review" />

      {state.notice ? (
        <p role="status" className="rounded-field bg-blue-soft px-4 py-3 text-[15px] font-bold text-blue-text">
          {state.notice}
        </p>
      ) : null}

      <div className="grid gap-5">
        <Field id="description" label="What was it?" error={errors.description}>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue={values.description}
            placeholder="Dinner at Bún Chả"
            autoComplete="off"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy("description", errors.description)}
            className={`${inputClass} ${placeholder}`}
          />
        </Field>

        <Field id="amount" label="Amount" error={errors.amount}>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="min-w-6 text-base font-bold text-muted">
              {currencySymbol(props.currency)}
            </span>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode={decimals ? "decimal" : "numeric"}
              defaultValue={values.amount}
              placeholder={decimals ? "1,250.50" : "250,000"}
              autoComplete="off"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={describedBy("amount", errors.amount)}
              className={`${inputClass} ${placeholder} flex-1`}
            />
          </div>
        </Field>

        <fieldset className="grid min-w-0 gap-1.5 border-0 p-0" aria-describedby={errors.paidBy ? "paidBy-error" : undefined}>
          <legend className={`${labelClass} mb-1.5 p-0`}>Who paid?</legend>
          <div className="flex flex-wrap gap-2">
            {props.people.map((person) => (
              <PersonChoice key={person.spotId} type="radio" name="paidBy" person={person} checked={values.paidBy === person.spotId} />
            ))}
          </div>
          {errors.paidBy ? (
            <span id="paidBy-error" className={errorClass}>
              {errors.paidBy}
            </span>
          ) : null}
        </fieldset>

        <fieldset className="grid min-w-0 gap-1.5 border-0 p-0" aria-describedby={errors.sharedBy ? "sharedBy-error" : undefined}>
          <legend className={`${labelClass} mb-1.5 p-0`}>Split equally between</legend>
          <div className="flex flex-wrap gap-2">
            {props.people.map((person) => (
              <PersonChoice
                key={person.spotId}
                type="checkbox"
                name="sharedBy"
                person={person}
                checked={values.sharedBy.includes(person.spotId)}
              />
            ))}
          </div>
          {errors.sharedBy ? (
            <span id="sharedBy-error" className={errorClass}>
              {errors.sharedBy}
            </span>
          ) : null}
        </fieldset>

        <Field id="spentOn" label="Date" error={errors.spentOn}>
          <input
            id="spentOn"
            name="spentOn"
            type="date"
            defaultValue={values.spentOn}
            aria-invalid={errors.spentOn ? true : undefined}
            aria-describedby={describedBy("spentOn", errors.spentOn)}
            className={`${inputClass} sm:w-56`}
          />
        </Field>

        <Field id="category" label="Category (optional)" error={errors.category}>
          <div className="relative">
            <select
              id="category"
              name="category"
              defaultValue={values.category}
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={describedBy("category", errors.category)}
              className={selectClass}
            >
              <option value="">No category</option>
              {COST_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <CaretDown
              size={18}
              weight="bold"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
            />
          </div>
        </Field>
      </div>

      <p role="alert" className={`${errorClass} empty:hidden`}>
        {errors.form}
      </p>

      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Checking…" : "Review"}
      </button>
    </form>
  );
}
