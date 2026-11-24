import { describe, expect, it } from "vitest";
import {
  BANK_SUGGESTIONS,
  PAYMENT_METHODS,
  formatAccountNumber,
  lastFour,
  paymentSentence,
  validatePaymentAccount,
  validatePaymentRecord,
} from "./payment-input";

const wallet = (number: string, extra: object = {}) =>
  validatePaymentAccount({ kind: "gcash", accountName: "Ana Cruz", number, ...extra });
const bank = (number: string, extra: object = {}) =>
  validatePaymentAccount({ kind: "bank", bankName: "BDO", accountName: "Ana", number, ...extra });

describe("validatePaymentAccount", () => {
  it.each(["09171234567", "639171234567", "+639171234567", "0917 123 4567", "0917-123-4567"])(
    "normalizes %s to 09171234567",
    (input) => {
      expect(wallet(input)).toEqual({
        ok: true,
        value: { kind: "gcash", accountName: "Ana Cruz", number: "09171234567" },
      });
    },
  );

  it.each(["0917123456", "091712345678", "08171234567", "63917123456", "abc", ""])(
    "refuses the e-wallet number %j",
    (input) => {
      expect(wallet(input)).toEqual({
        ok: false,
        errors: { number: "Enter an 11-digit number starting with 09." },
      });
    },
  );

  it("works for Maya and drops a stray bank name", () => {
    expect(
      validatePaymentAccount({ kind: "maya", accountName: "Ana", number: "0917 123 4567", bankName: "BDO" }),
    ).toEqual({ ok: true, value: { kind: "maya", accountName: "Ana", number: "09171234567" } });
  });

  it("accepts a bank account of 6 to 20 digits, spaces and dashes removed", () => {
    expect(bank("0012-3456 7890", { bankName: " BDO " })).toEqual({
      ok: true,
      value: { kind: "bank", bankName: "BDO", accountName: "Ana", number: "001234567890" },
    });
    for (const number of ["12345", "1".repeat(21), "12a456"]) {
      expect(bank(number)).toEqual({
        ok: false,
        errors: { number: "Enter the account number, 6 to 20 digits." },
      });
    }
    expect(bank("123456").ok).toBe(true);
    expect(bank("1".repeat(20)).ok).toBe(true);
  });

  it("needs a bank name only for a bank", () => {
    expect(validatePaymentAccount({ kind: "bank", accountName: "Ana", number: "123456" })).toEqual({
      ok: false,
      errors: { bankName: "Enter the bank name." },
    });
    expect(wallet("09171234567").ok).toBe(true);
  });

  it("limits the names", () => {
    expect(wallet("09171234567", { accountName: "   " })).toEqual({
      ok: false,
      errors: { accountName: "Enter the name on the account." },
    });
    expect(wallet("09171234567", { accountName: "a".repeat(80) }).ok).toBe(true);
    expect(wallet("09171234567", { accountName: "a".repeat(81) }).ok).toBe(false);
    expect(bank("123456", { bankName: "b".repeat(60) }).ok).toBe(true);
    expect(bank("123456", { bankName: "b".repeat(61) }).ok).toBe(false);
  });

  it("refuses an unknown kind", () => {
    expect(validatePaymentAccount({ kind: "card", accountName: "Ana", number: "09171234567" }).ok).toBe(false);
    expect(validatePaymentAccount({}).ok).toBe(false);
  });
});

describe("formatAccountNumber and lastFour", () => {
  it("groups numbers for reading", () => {
    expect(formatAccountNumber("gcash", "09171234567")).toBe("0917 123 4567");
    expect(formatAccountNumber("bank", "1234567890")).toBe("1234 5678 90");
    expect(formatAccountNumber("bank", "12345678")).toBe("1234 5678");
    expect(lastFour("1234567890")).toBe("7890");
  });
});

describe("validatePaymentRecord", () => {
  const php = { currency: "PHP", maxAmount: 90000, payerName: "Ben", receiverName: "Ana" };

  it("accepts an amount up to the line, for each method", () => {
    for (const method of PAYMENT_METHODS) {
      expect(validatePaymentRecord({ amount: "900", method }, php)).toEqual({
        ok: true,
        value: { amount: 90000, method },
      });
    }
    expect(validatePaymentRecord({ amount: "450.50", method: "cash" }, php)).toEqual({
      ok: true,
      value: { amount: 45050, method: "cash" },
    });
  });

  it("refuses a blank amount, zero, and a bad method", () => {
    expect(validatePaymentRecord({ amount: "", method: "gcash" }, php)).toEqual({
      ok: false,
      errors: { amount: "Enter an amount." },
    });
    expect(validatePaymentRecord({ amount: "0", method: "gcash" }, php).ok).toBe(false);
    expect(validatePaymentRecord({ amount: "5", method: "paypal" }, php)).toEqual({
      ok: false,
      errors: { method: "Choose how it was paid." },
    });
  });

  it("refuses more than the line with the amount in the message", () => {
    expect(validatePaymentRecord({ amount: "900.01", method: "gcash" }, php)).toEqual({
      ok: false,
      errors: { amount: "That's more than Ben owes Ana (₱900.00). Lower the amount." },
    });
  });

  it("says you for the viewer in the over-the-line message", () => {
    expect(validatePaymentRecord({ amount: "900.01", method: "gcash" }, { ...php, payerIsYou: true })).toEqual({
      ok: false,
      errors: { amount: "That's more than you owe Ana (₱900.00). Lower the amount." },
    });
    const receiver = { ...php, maxAmount: 45000, payerName: "Bea", receiverName: "Ben", receiverIsYou: true };
    expect(validatePaymentRecord({ amount: "450.01", method: "cash" }, receiver)).toEqual({
      ok: false,
      errors: { amount: "That's more than Bea owes you (₱450.00). Lower the amount." },
    });
  });

  it("respects 0-decimal currencies", () => {
    const vnd = { currency: "VND", maxAmount: 250000 };
    expect(validatePaymentRecord({ amount: "250,000", method: "bank" }, vnd).ok).toBe(true);
    expect(validatePaymentRecord({ amount: "100.5", method: "bank" }, vnd).ok).toBe(false);
    expect(validatePaymentRecord({ amount: "250001", method: "bank" }, vnd).ok).toBe(false);
  });
});

describe("paymentSentence", () => {
  const base = { payerName: "Ben", receiverName: "Ana", amount: 120000, currency: "PHP" } as const;

  it("says You for the payer", () => {
    expect(paymentSentence({ ...base, payerIsYou: true, receiverIsYou: false, method: "gcash" })).toBe(
      "You paid Ana ₱1,200.00 via GCash.",
    );
  });

  it("says you for the receiver, and in cash", () => {
    expect(
      paymentSentence({
        ...base,
        payerName: "Bea",
        amount: 45000,
        payerIsYou: false,
        receiverIsYou: true,
        method: "cash",
      }),
    ).toBe("Bea paid you ₱450.00 in cash.");
  });

  it("names both when you are neither, and words Maya and bank", () => {
    const neither = { ...base, payerIsYou: false, receiverIsYou: false };
    expect(paymentSentence({ ...neither, method: "maya" })).toBe("Ben paid Ana ₱1,200.00 via Maya.");
    expect(paymentSentence({ ...neither, method: "bank" })).toBe(
      "Ben paid Ana ₱1,200.00 via bank transfer.",
    );
  });
});

describe("BANK_SUGGESTIONS", () => {
  it("lists 16 banks", () => {
    expect(BANK_SUGGESTIONS).toHaveLength(16);
  });
});

describe("accountLabel", () => {
  it("names the wallet or the bank", async () => {
    const { accountLabel } = await import("./payment-input");
    expect(accountLabel({ kind: "gcash", bankName: null })).toBe("GCash");
    expect(accountLabel({ kind: "maya", bankName: null })).toBe("Maya");
    expect(accountLabel({ kind: "bank", bankName: "BPI" })).toBe("BPI");
  });
});
