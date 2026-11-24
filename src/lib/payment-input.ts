import { formatMoney, parseAmount } from "@/lib/money";

// Payment details and recorded payments: the checks and the wording. Pure functions, safe on
// the client and the server (the form shows the same errors the server enforces). There is no
// field for a card number, CVV, PIN, OTP or password, on purpose.

export type PaymentAccountInput =
  | { kind: "gcash" | "maya"; accountName: string; number: string }
  | { kind: "bank"; bankName: string; accountName: string; number: string };

export type PaymentAccountErrors = Partial<
  Record<"kind" | "bankName" | "accountName" | "number", string>
>;

export type PaymentAccountResult =
  | { ok: true; value: PaymentAccountInput }
  | { ok: false; errors: PaymentAccountErrors };

export const ACCOUNT_KINDS = ["gcash", "maya", "bank"] as const;

export const BANK_SUGGESTIONS = [
  "BDO",
  "BPI",
  "Metrobank",
  "UnionBank",
  "Landbank",
  "PNB",
  "Security Bank",
  "RCBC",
  "China Bank",
  "EastWest",
  "GoTyme",
  "Maribank",
  "SeaBank",
  "CIMB",
  "Tonik",
  "UNO Digital Bank",
] as const;

export const PAYMENT_METHODS = ["gcash", "maya", "bank", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
  cash: "Cash",
};

const ACCOUNT_NAME_MAX = 80;
const BANK_NAME_MAX = 60;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

// Checks a payment account the way the form and the server both need it. `values` is the raw
// form content; the bank name is read only for a bank account.
export function validatePaymentAccount(values: {
  kind?: unknown;
  bankName?: unknown;
  accountName?: unknown;
  number?: unknown;
}): PaymentAccountResult {
  const kind = values.kind;
  if (kind !== "gcash" && kind !== "maya" && kind !== "bank") {
    return { ok: false, errors: { kind: "Choose GCash, Maya or Bank." } };
  }
  const errors: PaymentAccountErrors = {};

  const bankName = text(values.bankName);
  if (kind === "bank") {
    if (bankName === "") errors.bankName = "Enter the bank name.";
    else if (Array.from(bankName).length > BANK_NAME_MAX) {
      errors.bankName = `Keep it to ${BANK_NAME_MAX} characters or fewer.`;
    }
  }

  const accountName = text(values.accountName);
  if (accountName === "") errors.accountName = "Enter the name on the account.";
  else if (Array.from(accountName).length > ACCOUNT_NAME_MAX) {
    errors.accountName = `Keep it to ${ACCOUNT_NAME_MAX} characters or fewer.`;
  }

  const raw = typeof values.number === "string" ? values.number.replace(/[\s-]/g, "") : "";
  let number = raw;
  if (kind === "bank") {
    if (!/^\d{6,20}$/.test(raw)) errors.number = "Enter the account number, 6 to 20 digits.";
  } else {
    // +639171234567 and 639171234567 are the same number as 09171234567.
    number = raw.replace(/^\+?63(?=9)/, "0");
    if (!/^09\d{9}$/.test(number)) errors.number = "Enter an 11-digit number starting with 09.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: kind === "bank" ? { kind, bankName, accountName, number } : { kind, accountName, number },
  };
}

// How a saved number reads on screen: 0917 123 4567, or groups of four for a bank account.
export function formatAccountNumber(kind: "gcash" | "maya" | "bank", digits: string): string {
  if (kind === "bank") return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  if (!/^\d{11}$/.test(digits)) return digits;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export function lastFour(digits: string): string {
  return digits.slice(-4);
}

export type PaymentRecordResult =
  | { ok: true; value: { amount: number; method: PaymentMethod } }
  | { ok: false; errors: Partial<Record<"amount" | "method", string>> };

// Checks "Mark it paid". The amount is in the trip's currency, above zero, and never above the
// line it settles (maxAmount, in minor units); it can be lowered for a part payment.
export function validatePaymentRecord(
  values: { amount?: unknown; method?: unknown },
  context: { currency: string; maxAmount: number; payerName?: string; receiverName?: string },
): PaymentRecordResult {
  const errors: Partial<Record<"amount" | "method", string>> = {};
  let amount = 0;

  const raw = typeof values.amount === "string" ? values.amount : "";
  if (raw.trim() === "") {
    errors.amount = "Enter an amount.";
  } else {
    const parsed = parseAmount(raw, context.currency);
    if (!parsed.ok) errors.amount = parsed.error;
    else if (parsed.minor > context.maxAmount) {
      const who =
        context.payerName && context.receiverName
          ? `${context.payerName} owes ${context.receiverName}`
          : "is owed";
      errors.amount = `That's more than ${who} (${formatMoney(context.maxAmount, context.currency)}). Lower the amount.`;
    } else amount = parsed.minor;
  }

  const method = values.method;
  if (typeof method !== "string" || !PAYMENT_METHODS.includes(method as PaymentMethod)) {
    errors.method = "Choose how it was paid.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { amount, method: method as PaymentMethod } };
}

// One line for the review step, the payment page and the delete page:
// "You paid Ana ₱1,200.00 via GCash." / "Bea paid you ₱450.00 in cash."
export function paymentSentence(args: {
  payerIsYou: boolean;
  payerName: string;
  receiverIsYou: boolean;
  receiverName: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
}): string {
  const payer = args.payerIsYou ? "You" : args.payerName;
  const receiver = args.receiverIsYou ? "you" : args.receiverName;
  const how =
    args.method === "cash"
      ? "in cash"
      : args.method === "bank"
        ? "via bank transfer"
        : `via ${METHOD_LABELS[args.method]}`;
  return `${payer} paid ${receiver} ${formatMoney(args.amount, args.currency)} ${how}.`;
}
