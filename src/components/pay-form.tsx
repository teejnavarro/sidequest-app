"use client";

import { startTransition, useActionState, useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { recordPaymentAction } from "@/app/trips/[tripId]/costs/payments/actions";
import { ChoiceChips, Field, describedBy } from "@/components/form-fields";
import { ImagePicker } from "@/components/image-picker";
import { errorClass, inputBoxClass, primaryButton, quietButton } from "@/components/ui";
import { currencySymbol } from "@/lib/idea-options";
import { formatMoney, minorDigits } from "@/lib/money";
import type { PayFormState } from "@/lib/payment-form-state";
import { paymentSentence, validatePaymentRecord, type PaymentMethod } from "@/lib/payment-input";

const METHOD_OPTIONS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
];

type Review = { amount: number; method: PaymentMethod };

// "Mark it paid" and its review step. The review is checked on the phone and shown on the same
// page; the form stays mounted but hidden, so a picked receipt is kept. Save sends the form
// itself (not the form's reset-after-send action), and the server checks everything again from
// fresh balances: its errors close the review and show here.
export function PayForm({
  tripId,
  paymentId,
  fromSpot,
  toSpot,
  currency,
  maxAmount,
  amountPrefill,
  payerName,
  receiverName,
  payerIsYou,
  receiverIsYou,
  otherName,
  heading,
  methodLegend,
}: {
  tripId: string;
  paymentId: string;
  fromSpot: string;
  toSpot: string;
  currency: string;
  maxAmount: number; // minor units: the line right now
  amountPrefill: string;
  payerName: string;
  receiverName: string;
  payerIsYou: boolean;
  receiverIsYou: boolean;
  otherName: string; // the other person involved, from the viewer's side
  heading: string;
  methodLegend: string;
}) {
  const [state, formAction, pending] = useActionState<PayFormState, FormData>(recordPaymentAction, {
    errors: {},
    values: { amount: amountPrefill, method: receiverIsYou ? "cash" : "gcash" },
  });
  const [amount, setAmount] = useState(state.values.amount);
  const [method, setMethod] = useState(state.values.method);
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [clientErrors, setClientErrors] = useState<PayFormState["errors"] | null>(null);
  // When the server answers (its errors), the review closes and its errors replace ours.
  const [shown, setShown] = useState(state);
  if (shown !== state) {
    setShown(state);
    setReview(null);
    setClientErrors(null);
  }
  const errors = clientErrors ?? state.errors;
  const decimals = minorDigits(currency) > 0;

  function goReview() {
    const result = validatePaymentRecord(
      { amount, method },
      { currency, maxAmount, payerName, receiverName, payerIsYou, receiverIsYou },
    );
    if (!result.ok) {
      setClientErrors(result.errors);
      setReview(null);
      return;
    }
    setClientErrors(null);
    setReview(result.value);
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // Only the Save payment step may send; anything else (Enter in a box) opens the review.
        if (!review) {
          goReview();
          return;
        }
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid gap-4"
    >
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="fromSpot" value={fromSpot} />
      <input type="hidden" name="toSpot" value={toSpot} />
      <h2 className="text-[19px]">{heading}</h2>

      <div className={review ? "hidden" : "grid gap-5"}>
        <Field id="amount" label="Amount" error={errors.amount} help="Paying part of it? Lower the amount.">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-bold" aria-hidden="true">
              {currencySymbol(currency)}
            </span>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode={decimals ? "decimal" : "numeric"}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goReview();
                }
              }}
              autoComplete="off"
              aria-invalid={errors.amount ? true : undefined}
              aria-describedby={describedBy("amount", errors.amount, "help")}
              className={`${inputBoxClass} min-w-0 flex-1 tabular-nums`}
            />
          </div>
        </Field>

        <ChoiceChips
          name="method"
          legend={methodLegend}
          options={METHOD_OPTIONS}
          value={method}
          error={errors.method}
          onChange={setMethod}
        />

        <div className="grid min-w-0 gap-1.5">
          <span className="text-sm font-bold">Receipt (optional)</span>
          <ImagePicker
            name="receipt"
            icon="image"
            addLabel="Add a screenshot"
            help={`Only you and ${otherName} can see it.`}
            previewAlt="Your receipt"
            onPreview={setReceiptSrc}
          />
          {errors.receipt ? <span className={errorClass}>{errors.receipt}</span> : null}
        </div>

        <button type="button" onClick={goReview} className={`${primaryButton} w-full`}>
          Review
        </button>
        <p role="alert" className={`${errorClass} empty:hidden`}>
          {errors.form}
        </p>
      </div>

      <div className={review ? "grid gap-4" : "hidden"} aria-hidden={review ? undefined : true}>
        {review ? (
          <>
            <p className="rounded-field bg-blue-soft px-4 py-3 text-[15px] font-bold text-blue-text wrap-anywhere">
              {paymentSentence({
                payerIsYou,
                payerName,
                receiverIsYou,
                receiverName,
                amount: review.amount,
                currency,
                method: review.method,
              })}
            </p>
            {review.amount < maxAmount ? (
              <p className="text-[15px] font-bold">{formatMoney(maxAmount - review.amount, currency)} still to pay.</p>
            ) : null}
            {receiptSrc ? (
              <div className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptSrc} alt="" className="size-10 shrink-0 rounded-field bg-chip object-cover" />
                <span className="min-w-0 flex-1 text-sm text-muted">
                  Receipt attached. Only you and {otherName} can see it.
                </span>
                <Check size={18} weight="bold" aria-hidden="true" className="shrink-0 text-owed" />
              </div>
            ) : null}
            <p className="text-sm text-muted">
              Balances update right away. You or {otherName} can delete it later.
            </p>
            <div className="grid gap-3">
              <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
                {pending ? "Saving…" : "Save payment"}
              </button>
              <button type="button" onClick={() => setReview(null)} className={`${quietButton} w-full`}>
                Change something
              </button>
            </div>
          </>
        ) : null}
      </div>
    </form>
  );
}
