// What the payment forms remember between tries. Lives outside the "use server" files because
// such files may only export functions. Plain data only.

export type AccountFormValues = {
  kind: string;
  bankName: string;
  accountName: string;
  number: string;
};

export type AccountFormState = {
  errors: Partial<Record<"kind" | "bankName" | "accountName" | "number" | "qr" | "form", string>>;
  values: AccountFormValues;
};

export const emptyAccountValues: AccountFormValues = {
  kind: "gcash",
  bankName: "",
  accountName: "",
  number: "",
};

export type PayFormValues = { amount: string; method: string };

export type PayFormState = {
  errors: Partial<Record<"amount" | "method" | "receipt" | "form", string>>;
  values: PayFormValues;
};

export const emptyPayValues: PayFormValues = { amount: "", method: "" };

export type PaymentDeleteState = { error?: string };
