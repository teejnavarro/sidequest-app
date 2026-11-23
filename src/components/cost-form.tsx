"use client";

import { useActionState, useState } from "react";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react/dist/ssr";
import { reviewOrSaveCostAction } from "@/app/trips/[tripId]/costs/actions";
import type { CostFormState, CostFormValues, CostPerson } from "@/lib/cost-form-state";
import { COST_CATEGORIES } from "@/lib/cost-options";
import { currencySymbol } from "@/lib/idea-options";
import { formatMoney, minorDigits, parseAmount, splitByItems, splitEqually } from "@/lib/money";
import { CostReviewView } from "@/components/cost-review";
import { Face } from "@/components/face";
import { Field, describedBy } from "@/components/form-fields";
import {
  errorClass,
  focusRing,
  guestTag,
  inputBoxClass,
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
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  person: CostPerson;
  checked: boolean;
  // Given for a controlled choice (Split between, which the uneven panel follows).
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="relative">
      <input
        type={type}
        name={name}
        value={person.spotId}
        {...(onChange
          ? { checked, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.checked) }
          : { defaultChecked: checked })}
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

function OwnHelper({ helper }: { helper: { over: boolean; text: string } | null }) {
  if (!helper) return null;
  return (
    <p className={`rounded-field px-3 py-2 text-[13px] font-bold ${helper.over ? "bg-card text-owe" : "bg-blue-soft text-blue-text"}`}>
      {helper.text}
    </p>
  );
}

// The live line under the own-amount boxes: what is left over and the equal part, or how far
// over the total they are. Feedback only: Save checks and splits again on the server.
function ownHelper(amount: string, own: Record<string, string>, sharedBy: string[], currency: string) {
  const total = parseAmount(amount, currency);
  if (!total.ok || sharedBy.length === 0) return null;
  const owns = sharedBy.flatMap((spotId) => {
    const parsed = parseAmount(own[spotId] ?? "", currency);
    return parsed.ok ? [{ spotId, own: parsed.minor }] : [];
  });
  const split = splitByItems(total.minor, sharedBy, owns, "");
  if (!split) {
    const given = owns.reduce((sum, item) => sum + item.own, 0);
    return { over: true, text: `That's ${formatMoney(given - total.minor, currency)} more than the total.` };
  }
  if (split.rest === 0) return { over: false, text: "Nothing left over." };
  const parts = splitEqually(split.rest, sharedBy, "").map((part) => part.amount);
  const low = Math.min(...parts);
  const high = Math.max(...parts);
  const each = low === high ? formatMoney(low, currency) : `${formatMoney(low, currency)} to ${formatMoney(high, currency)}`;
  return { over: false, text: `${formatMoney(split.rest, currency)} left over, shared equally: ${each} each` };
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
  // Split between and the amount are tracked so the uneven panel can follow them. The rest of
  // the boxes stay uncontrolled.
  const [sharedBy, setSharedBy] = useState(values.sharedBy);
  const [amount, setAmount] = useState(values.amount);
  const [open, setOpen] = useState(values.split === "items");
  const [own, setOwn] = useState(values.own);
  // When the server sends back new state (a newer copy after "Someone just changed this
  // cost"), these follow it, like the uncontrolled boxes do through the form's key.
  const [shown, setShown] = useState(state);
  if (shown !== state) {
    setShown(state);
    setSharedBy(values.sharedBy);
    setAmount(values.amount);
    setOpen(values.split === "items");
    setOwn(values.own);
  }

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
        <input type="hidden" name="split" value={values.split} />
        {values.split === "items"
          ? values.sharedBy.map((spotId) => (
              <input key={spotId} type="hidden" name={`own:${spotId}`} value={values.own[spotId] ?? ""} />
            ))
          : null}

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
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
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
          <legend className={`${labelClass} mb-1.5 p-0`}>Split between</legend>
          <div className="flex flex-wrap gap-2">
            {props.people.map((person) => (
              <PersonChoice
                key={person.spotId}
                type="checkbox"
                name="sharedBy"
                person={person}
                checked={sharedBy.includes(person.spotId)}
                onChange={(on) =>
                  setSharedBy((now) => (on ? [...now, person.spotId] : now.filter((id) => id !== person.spotId)))
                }
              />
            ))}
          </div>
          {errors.sharedBy ? (
            <span id="sharedBy-error" className={errorClass}>
              {errors.sharedBy}
            </span>
          ) : null}

          <button
            type="button"
            aria-expanded={open}
            aria-controls="own-panel"
            onClick={() => setOpen((now) => !now)}
            className={`mt-1 inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-bold text-blue-text ${focusRing}`}
          >
            Not an even split? Add what each person had
            {open ? <CaretUp size={16} weight="bold" aria-hidden="true" /> : <CaretDown size={16} weight="bold" aria-hidden="true" />}
          </button>
          {open ? (
            <div id="own-panel" className="grid gap-3 rounded-field bg-chip p-3.5">
              <input type="hidden" name="split" value="items" />
              <p className="text-[13px] text-muted">Leave a box empty if they only share the rest.</p>
              {props.people
                .filter((person) => sharedBy.includes(person.spotId))
                .map((person) => (
                  <div key={person.spotId} className="flex min-w-0 items-center gap-3">
                    <Face userId={person.userId} name={person.name} image={person.image} size={28} decorative neutral={person.isGuest} />
                    <span className="min-w-0 flex-1 text-sm font-bold wrap-anywhere">
                      {person.isYou ? "You" : person.name}
                      {person.isGuest ? <span className={`${guestTag} ml-2`}>Guest</span> : null}
                      {person.hasLeft ? <span className={`${guestTag} ml-2`}>Left</span> : null}
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-base font-bold text-muted">
                      {currencySymbol(props.currency)}
                    </span>
                    <input
                      name={`own:${person.spotId}`}
                      type="text"
                      inputMode={decimals ? "decimal" : "numeric"}
                      value={own[person.spotId] ?? ""}
                      onChange={(event) => setOwn((now) => ({ ...now, [person.spotId]: event.target.value }))}
                      aria-label={`${person.isYou ? "Your" : `${person.name}'s`} amount`}
                      aria-invalid={errors.own ? true : undefined}
                      aria-describedby={errors.own ? "own-error" : undefined}
                      autoComplete="off"
                      placeholder="0"
                      className={`${inputBoxClass} ${placeholder} w-28 shrink-0 text-right tabular-nums`}
                    />
                  </div>
                ))}
              <OwnHelper helper={ownHelper(amount, own, sharedBy, props.currency)} />
            </div>
          ) : (
            <input type="hidden" name="split" value="equal" />
          )}
          {errors.own ? (
            <span id="own-error" className={errorClass}>
              {errors.own}
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
