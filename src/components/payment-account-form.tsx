"use client";

import { startTransition, useActionState, useState } from "react";
import { savePaymentAccountAction } from "@/app/profile/payment-details/actions";
import { ChoiceChips, Field, describedBy } from "@/components/form-fields";
import { ImagePicker } from "@/components/image-picker";
import { errorClass, inputClass, primaryButton } from "@/components/ui";
import type { AccountFormState, AccountFormValues } from "@/lib/payment-form-state";
import { BANK_SUGGESTIONS } from "@/lib/payment-input";

const KIND_OPTIONS = [
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank", label: "Bank" },
];

const placeholder = "placeholder:text-muted";

// One form for adding and editing payment details. Only the named fields exist: type, bank,
// account name, number and an optional QR. There is no box for a card number, PIN or code.
// It sends itself (instead of using the form's reset-after-send action) so a picked QR is
// still there when the server answers with an error.
export function PaymentAccountForm({
  accountId,
  values,
  savedQrSrc,
}: {
  accountId: string | null;
  values: AccountFormValues;
  savedQrSrc: string | null;
}) {
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(savePaymentAccountAction, {
    errors: {},
    values,
  });
  const [kind, setKind] = useState(values.kind || "gcash");
  const { errors } = state;
  const isBank = kind === "bank";
  const numberLabel = kind === "gcash" ? "GCash number" : kind === "maya" ? "Maya number" : "Account number";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="grid gap-6"
    >
      {accountId ? <input type="hidden" name="accountId" value={accountId} /> : null}

      <div className="grid gap-5">
        <ChoiceChips
          name="kind"
          legend="Type"
          options={KIND_OPTIONS}
          value={kind}
          error={errors.kind}
          onChange={setKind}
        />

        {isBank ? (
          <Field id="bankName" label="Bank" error={errors.bankName} help="Type it or pick from the list.">
            <input
              id="bankName"
              name="bankName"
              type="text"
              list="bank-suggestions"
              defaultValue={values.bankName}
              placeholder="BPI"
              autoComplete="off"
              aria-invalid={errors.bankName ? true : undefined}
              aria-describedby={describedBy("bankName", errors.bankName, "help")}
              className={`${inputClass} ${placeholder}`}
            />
            <datalist id="bank-suggestions">
              {BANK_SUGGESTIONS.map((bank) => (
                <option key={bank} value={bank} />
              ))}
            </datalist>
          </Field>
        ) : null}

        <Field
          id="accountName"
          label="Account name"
          error={errors.accountName}
          help={isBank ? "As it shows in your bank app." : "As it shows in your app."}
        >
          <input
            id="accountName"
            name="accountName"
            type="text"
            defaultValue={values.accountName}
            autoComplete="off"
            aria-invalid={errors.accountName ? true : undefined}
            aria-describedby={describedBy("accountName", errors.accountName, "help")}
            className={inputClass}
          />
        </Field>

        <Field id="number" label={numberLabel} error={errors.number}>
          <input
            id="number"
            name="number"
            type="text"
            inputMode="numeric"
            defaultValue={values.number}
            placeholder={isBank ? "1234 5678 90" : "0917 123 4567"}
            autoComplete="off"
            aria-invalid={errors.number ? true : undefined}
            aria-describedby={describedBy("number", errors.number)}
            className={`${inputClass} ${placeholder} tabular-nums`}
          />
        </Field>

        <div className="grid min-w-0 gap-1.5">
          <span className="text-sm font-bold">QR image (optional)</span>
          <ImagePicker
            name="qr"
            actionName="qrAction"
            savedSrc={savedQrSrc}
            icon="qr"
            addLabel="Add a QR image"
            help="A screenshot of your receive QR. It's made smaller before it uploads."
            previewAlt="Your QR code"
          />
          {errors.qr ? <span className={errorClass}>{errors.qr}</span> : null}
        </div>
      </div>

      <div className="grid gap-3">
        <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <p role="alert" className={`${errorClass} empty:hidden`}>
          {errors.form}
        </p>
      </div>
    </form>
  );
}
