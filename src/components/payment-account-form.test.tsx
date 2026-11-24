import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PaymentAccountForm } from "./payment-account-form";
import { emptyAccountValues, type AccountFormState } from "@/lib/payment-form-state";

const mocks = vi.hoisted(() => ({ forced: null as unknown }));

vi.mock("@/app/profile/payment-details/actions", () => ({ savePaymentAccountAction: async () => ({}) }));
// Lets a test show the form as it looks after the server sent errors back.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: unknown, initial: unknown) => [mocks.forced ?? initial, () => {}, false],
  };
});

function render(values = emptyAccountValues, forced: AccountFormState | null = null, accountId: string | null = null) {
  mocks.forced = forced;
  return renderToStaticMarkup(<PaymentAccountForm accountId={accountId} values={values} savedQrSrc={null} />);
}

describe("PaymentAccountForm", () => {
  it("shows the three types, a GCash number box and no bank box by default", () => {
    const html = render();
    expect(html).toContain("GCash");
    expect(html).toContain("Maya");
    expect(html).toContain("Bank");
    expect(html).toMatch(/<label[^>]*for="number"[^>]*>GCash number<\/label>/);
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain("As it shows in your app.");
    expect(html).not.toContain('name="bankName"');
    expect(html).not.toContain("bank-suggestions");
  });

  it("shows the bank box with its suggestions and the bank wording for a bank account", () => {
    const html = render({ kind: "bank", bankName: "BPI", accountName: "Ana Cruz", number: "1234567890" });
    expect(html).toContain('name="bankName"');
    expect(html).toContain('list="bank-suggestions"');
    expect(html).toContain('<option value="BPI"></option>');
    expect(html).toContain("Type it or pick from the list.");
    expect(html).toContain("As it shows in your bank app.");
    expect(html).toMatch(/<label[^>]*for="number"[^>]*>Account number<\/label>/);
    expect(html).toContain('value="BPI"');
  });

  it("labels the Maya number", () => {
    expect(render({ ...emptyAccountValues, kind: "maya" })).toMatch(/<label[^>]*for="number"[^>]*>Maya number<\/label>/);
  });

  it("posts only the named fields, with no card, PIN or code boxes", () => {
    const html = render();
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set(["kind", "accountName", "number", "qr", "qrAction"]));
    expect(html).not.toMatch(/name="[^"]*(card|cvv|pin|otp|password)/i);
  });

  it("adds the account id only when editing", () => {
    expect(render()).not.toContain('name="accountId"');
    expect(render(emptyAccountValues, null, "acc-1")).toContain('name="accountId" value="acc-1"');
  });

  it("starts with an Add a QR image button and a Save details button", () => {
    const html = render();
    expect(html).toContain("Add a QR image");
    expect(html).toContain("It&#x27;s made smaller before it uploads.");
    expect(html).toContain(">Save details</button>");
  });

  it("puts each server error under its own box and keeps what was typed", () => {
    const html = render(
      { kind: "gcash", bankName: "", accountName: "Ana", number: "123" },
      {
        errors: { number: "Enter an 11-digit number starting with 09.", accountName: "Enter the name on the account." },
        values: { kind: "gcash", bankName: "", accountName: "Ana", number: "123" },
      },
    );
    expect(html).toMatch(/id="number-error"[^>]*>Enter an 11-digit number starting with 09\./);
    expect(html).toMatch(/id="accountName-error"[^>]*>Enter the name on the account\./);
    expect(html).toContain('aria-describedby="number-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('value="123"');
  });

  it("shows a form-level error in an alert", () => {
    const html = render(emptyAccountValues, { errors: { form: "You can save up to 10 payment accounts." }, values: emptyAccountValues });
    expect(html).toMatch(/role="alert"[^>]*>You can save up to 10 payment accounts\./);
  });
});
