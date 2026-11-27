"use client";

import { useActionState, useState } from "react";
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react/dist/ssr";
import { reviewOrSaveCostAction } from "@/app/trips/[tripId]/costs/actions";
import type { CostFormState, CostFormValues, CostPerson } from "@/lib/cost-form-state";
import { COST_CATEGORIES } from "@/lib/cost-options";
import { currencySymbol } from "@/lib/idea-options";
import { splitOwnRule } from "@/lib/cost-input";
import {
  convertByRate,
  effectiveRateText,
  formatMoney,
  minorDigits,
  parseAmount,
  parseRate,
  rateText,
  splitEqually,
} from "@/lib/money";
import { CURRENCIES } from "@/lib/trip-options";
import { CostReviewView } from "@/components/cost-review";
import { Face } from "@/components/face";
import { Field, describedBy } from "@/components/form-fields";
import { ImagePicker } from "@/components/image-picker";
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
  // The address of the saved receipt photo (the checked route), for the picker's preview on an
  // edit; null when there is none. Never a storage path.
  photoSrc?: string | null;
};

// Both the form and the review form carry this id. The photo picker stays mounted outside them
// (so a picked file survives the swap to the review) and its inputs point here.
const FORM_ID = "cost-form";

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

// The live line under the own-amount boxes: what is left over and the equal part, or the same
// message Save would refuse with. Feedback only: Save checks and splits again on the server.
function ownHelper(
  amount: string,
  own: Record<string, string>,
  sharedBy: string[],
  currency: string,
  people: CostPerson[],
) {
  const total = parseAmount(amount, currency);
  if (!total.ok || sharedBy.length === 0) return null;
  const owns = sharedBy.flatMap((spotId) => {
    const parsed = parseAmount(own[spotId] ?? "", currency);
    return parsed.ok ? [{ spotId, own: parsed.minor }] : [];
  });
  const names = Object.fromEntries(people.map((person) => [person.spotId, person.isYou ? "You" : person.name]));
  const split = splitOwnRule({ total: total.minor, sharedBy, own: owns, paidBy: "", currency, names });
  if ("error" in split) return { over: true, text: split.error };
  if (split.rest === 0) return { over: false, text: "Nothing left over." };
  const parts = splitEqually(split.rest, sharedBy, "").map((part) => part.amount);
  const low = Math.min(...parts);
  const high = Math.max(...parts);
  const each = low === high ? formatMoney(low, currency) : `${formatMoney(low, currency)} to ${formatMoney(high, currency)}`;
  return { over: false, text: `${formatMoney(split.rest, currency)} left over, shared equally: ${each} each` };
}

// The soft-blue line in the other-currency panel: what the amount comes to, or the rate the
// card amount works out to. Null while the boxes don't parse. A helper only: the server decides.
function convertLine(options: {
  selected: string;
  trip: string;
  fx: string;
  amount: string;
  rate: string;
  charged: string;
}): string | null {
  const { selected, trip, fx, amount, rate, charged } = options;
  const original = parseAmount(amount, selected);
  if (!original.ok) return null;
  if (fx === "charged") {
    const main = parseAmount(charged, trip);
    if (!main.ok || main.minor === 0 || original.minor === 0) return null;
    const effective = effectiveRateText({ original: original.minor, from: selected, main: main.minor, to: trip });
    return `Works out to ${rateText(effective, selected, trip)}`;
  }
  const parsedRate = parseRate(rate);
  if (!parsedRate.ok) return null;
  const main = convertByRate({ original: original.minor, from: selected, to: trip, rate: parsedRate.rate });
  return main === null ? null : `That's ${formatMoney(main, trip)}`;
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
  const [currency, setCurrency] = useState(values.currency || props.currency);
  const [fx, setFx] = useState(values.fx);
  const [rate, setRate] = useState(values.rate);
  const [charged, setCharged] = useState(values.charged);
  const [open, setOpen] = useState(values.split === "items");
  const [own, setOwn] = useState(values.own);
  // When the server sends back new state (a newer copy after "Someone just changed this
  // cost"), these follow it, like the uncontrolled boxes do through the form's key.
  const [shown, setShown] = useState(state);
  if (shown !== state) {
    setShown(state);
    setSharedBy(values.sharedBy);
    setAmount(values.amount);
    setCurrency(values.currency || props.currency);
    setFx(values.fx);
    setRate(values.rate);
    setCharged(values.charged);
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

  const reviewing = state.review !== null && hiddenFor !== state;
  const reviewForm =
    state.review && hiddenFor !== state ? (
      <form id={FORM_ID} action={formAction} className="grid gap-5">
        {hidden}
        <input type="hidden" name="step" value="save" />
        <input type="hidden" name="description" value={values.description} />
        <input type="hidden" name="amount" value={values.amount} />
        <input type="hidden" name="currency" value={values.currency} />
        <input type="hidden" name="fx" value={values.fx} />
        <input type="hidden" name="rate" value={values.rate} />
        <input type="hidden" name="charged" value={values.charged} />
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
    ) : null;

  const foreign = currency !== props.currency;
  const decimals = minorDigits(currency) > 0;
  const tripSymbol = currencySymbol(props.currency);
  const line = foreign ? convertLine({ selected: currency, trip: props.currency, fx, amount, rate, charged }) : null;
  const chargedLabel = props.currency === "PHP" ? "Pesos" : props.currency;
  const currencies = [props.currency, ...CURRENCIES.map((option) => option.value).filter((code) => code !== props.currency)];

  // A new key gives the boxes fresh values when the server sends back a newer copy.
  const editForm = (
    <form id={FORM_ID} key={`${state.updatedAt}|${state.notice ?? ""}`} action={formAction} className="grid" noValidate>
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

        <div className="grid gap-3">
          <Field id="amount" label="Amount" error={errors.amount}>
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <select
                  name="currency"
                  aria-label="Currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={`${inputBoxClass} appearance-none pr-9 font-bold`}
                >
                  {currencies.map((code) => (
                    <option key={code} value={code}>
                      {currencySymbol(code)} {code}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
                />
              </div>
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
                className={`${inputBoxClass} ${placeholder} min-w-0 flex-1`}
              />
            </div>
          </Field>

          {foreign ? (
            <div className="grid gap-3 rounded-field bg-chip p-3">
              <div className="grid grid-cols-2 rounded-full border border-line bg-card p-1">
                {[
                  { value: "rate", label: "Use a rate" },
                  { value: "charged", label: `Card charged ${props.currency === "PHP" ? "pesos" : props.currency}` },
                ].map((option) => (
                  <label key={option.value} className="relative">
                    <input
                      type="radio"
                      name="fx"
                      value={option.value}
                      checked={fx === option.value}
                      onChange={() => setFx(option.value)}
                      className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                    <span className="grid min-h-9 place-items-center rounded-full px-1.5 text-center text-[13px] font-bold peer-checked:bg-blue-soft peer-checked:text-blue-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-text">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
              {fx === "charged" ? (
                <Field id="charged" label={`${chargedLabel} charged`} error={errors.charged} help="From your card or bank app.">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="min-w-6 text-base font-bold text-muted">
                      {tripSymbol}
                    </span>
                    <input
                      id="charged"
                      name="charged"
                      type="text"
                      inputMode={minorDigits(props.currency) > 0 ? "decimal" : "numeric"}
                      value={charged}
                      onChange={(event) => setCharged(event.target.value)}
                      placeholder={minorDigits(props.currency) > 0 ? "7,412.60" : "7,412"}
                      autoComplete="off"
                      aria-invalid={errors.charged ? true : undefined}
                      aria-describedby={describedBy("charged", errors.charged, "help")}
                      className={`${inputBoxClass} ${placeholder} min-w-0 flex-1`}
                    />
                  </div>
                </Field>
              ) : (
                <Field id="rate" label="Rate" error={errors.rate}>
                  <div className="flex items-center gap-2 font-bold">
                    <span>{tripSymbol}1 =</span>
                    <span aria-hidden="true">{currencySymbol(currency)}</span>
                    <input
                      id="rate"
                      name="rate"
                      type="text"
                      inputMode="decimal"
                      value={rate}
                      onChange={(event) => setRate(event.target.value)}
                      placeholder="435"
                      autoComplete="off"
                      aria-invalid={errors.rate ? true : undefined}
                      aria-describedby={describedBy("rate", errors.rate)}
                      className={`${inputBoxClass} ${placeholder} min-w-0 flex-1`}
                    />
                  </div>
                </Field>
              )}
              {line ? <p className="rounded-field bg-blue-soft px-3 py-2 text-sm font-bold text-blue-text">{line}</p> : null}
            </div>
          ) : (
            <>
              <input type="hidden" name="fx" value={fx} />
              <input type="hidden" name="rate" value={rate} />
              <input type="hidden" name="charged" value={charged} />
            </>
          )}
        </div>

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
                      {currencySymbol(currency)}
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
              <OwnHelper helper={ownHelper(amount, own, sharedBy, currency, props.people)} />
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

    </form>
  );

  return (
    <div className="grid gap-6">
      {reviewForm ?? editForm}
      {/* Mounted for good, hidden while the review shows, so the picked file is still there on Save. */}
      <div className={reviewing ? "hidden" : "grid min-w-0 gap-1.5"}>
        <span className={labelClass}>Receipt photo (optional)</span>
        <ImagePicker
          name="photo"
          actionName="photoAction"
          form={FORM_ID}
          savedSrc={props.photoSrc ?? null}
          icon="camera"
          addLabel="Add a receipt photo"
          help="Everyone in this trip can see it."
          previewAlt="Receipt photo"
        />
      </div>
      {reviewing ? null : (
        <>
          <p role="alert" className={`${errorClass} empty:hidden`}>
            {errors.form}
          </p>
          <button type="submit" form={FORM_ID} disabled={pending} className={`${primaryButton} w-full`}>
            {pending ? "Checking…" : "Review"}
          </button>
        </>
      )}
    </div>
  );
}
