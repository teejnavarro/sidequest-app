import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayForm } from "./pay-form";
import type { PayFormState } from "@/lib/payment-form-state";

const mocks = vi.hoisted(() => ({ forced: null as unknown }));

vi.mock("@/app/trips/[tripId]/costs/payments/actions", () => ({ recordPaymentAction: async () => ({}) }));
// Lets a test show the form as it looks after the server sent errors back.
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useActionState: (action: unknown, initial: unknown) => [mocks.forced ?? initial, () => {}, false],
  };
});

const base = {
  tripId: "trip-1",
  paymentId: "7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44",
  fromSpot: "ben",
  toSpot: "ana",
  currency: "PHP",
  maxAmount: 120000,
  amountPrefill: "1200.00",
  payerName: "Ben",
  receiverName: "Ana",
  payerIsYou: true,
  receiverIsYou: false,
  otherName: "Ana",
  heading: "Mark it paid",
  methodLegend: "How did you pay?",
};

function render(forced: PayFormState | null = null, props: Partial<typeof base> = {}) {
  mocks.forced = forced;
  return renderToStaticMarkup(<PayForm {...base} {...props} />);
}

describe("PayForm", () => {
  it("has the heading, a prefilled amount with its help, four method chips and a Review button", () => {
    const html = render();
    expect(html).toContain("Mark it paid");
    expect(html).toMatch(/<label[^>]*for="amount"[^>]*>Amount<\/label>/);
    expect(html).toContain('value="1200.00"');
    expect(html).toContain("Paying part of it? Lower the amount.");
    expect(html).toContain("How did you pay?");
    for (const label of ["GCash", "Maya", "Bank", "Cash"]) expect(html).toContain(`>${label}</span>`);
    expect(html).toContain(">Review</button>");
    expect(html).toContain("Add a screenshot");
    expect(html).toContain("Only you and Ana can see it.");
  });

  it("starts on GCash for the payer and Cash for the receiver", () => {
    const chosen = (html: string) => html.match(/<input[^>]*type="radio"[^>]*checked[^>]*>/)?.[0] ?? "";
    expect(chosen(render())).toContain('value="gcash"');
    const receiver = render(null, { payerIsYou: false, receiverIsYou: true, payerName: "Bea", receiverName: "Ben", otherName: "Bea" });
    expect(chosen(receiver)).toContain('value="cash"');
  });

  it("posts only the named fields, and keeps the form mounted while the review is closed", () => {
    const html = render();
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names)).toEqual(
      new Set(["tripId", "paymentId", "fromSpot", "toSpot", "amount", "method", "receipt"]),
    );
    expect(html).toContain('name="paymentId" value="7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44"');
    // The review area exists but is hidden until the person taps Review.
    expect(html).not.toContain("Save payment");
  });

  it("shows server errors under their boxes and in an alert", () => {
    const html = render({
      errors: { amount: "That's more than you owe Ana (₱900.00). Lower the amount.", method: "Choose how it was paid.", form: "Couldn't save the payment. Please try again." },
      values: { amount: "1200.00", method: "" },
    });
    expect(html).toMatch(/id="amount-error"[^>]*>That&#x27;s more than you owe Ana \(₱900\.00\)\. Lower the amount\./);
    expect(html).toContain("Choose how it was paid.");
    expect(html).toMatch(/role="alert"[^>]*>Couldn&#x27;t save the payment\. Please try again\./);
    expect(html).toContain('aria-invalid="true"');
  });
});
