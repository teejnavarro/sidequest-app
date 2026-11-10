import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CostForm } from "./cost-form";
import { emptyCostValues, type CostPerson } from "@/lib/cost-form-state";

vi.mock("@/app/trips/[tripId]/costs/actions", () => ({
  reviewOrSaveCostAction: async () => ({ errors: {}, values: {}, review: null, notice: null, updatedAt: "" }),
}));

const people: CostPerson[] = [
  { spotId: "a", userId: "u1", name: "Maya", image: null, isGuest: false, isYou: true },
  { spotId: "b", userId: "u2", name: "Ben", image: null, isGuest: false, isYou: false },
  { spotId: "g", userId: "g", name: "Dana", image: null, isGuest: true, isYou: false },
];

const filled = {
  description: "Dinner",
  amount: "1250.50",
  paidBy: "b",
  sharedBy: ["a", "b"],
  spentOn: "2027-05-09",
  category: "food",
};

const form = (extra: Partial<Parameters<typeof CostForm>[0]> = {}) =>
  renderToStaticMarkup(
    <CostForm
      mode="new"
      tripId="trip-1"
      costId="cost-1"
      currency="PHP"
      people={people}
      values={{ ...emptyCostValues, paidBy: "a", sharedBy: ["a", "b", "g"], spentOn: "2027-05-09" }}
      updatedAt=""
      {...extra}
    />,
  );

describe("CostForm", () => {
  it("keeps every field name the server reads, plus the hidden ones", () => {
    const html = form();
    for (const name of ["description", "amount", "paidBy", "sharedBy", "spentOn", "category", "tripId", "costId", "mode", "step", "updatedAt"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('name="step" value="review"');
    expect(html).toContain('name="mode" value="new"');
    expect(html).toContain('name="costId" value="cost-1"');
  });

  it("uses the approved labels and a Review button", () => {
    const html = form();
    expect(html).toContain("What was it?");
    expect(html).toContain(">Amount<");
    expect(html).toContain("Who paid?");
    expect(html).toContain("Split equally between");
    expect(html).toContain(">Date<");
    expect(html).toContain("Category (optional)");
    expect(html).toContain(">Review<");
  });

  it("lists everyone, guests included, in both pickers, with You and the Guest tag", () => {
    const html = form();
    expect(html.match(/type="radio"[^>]*name="paidBy"/g)).toHaveLength(3);
    expect(html.match(/type="checkbox"[^>]*name="sharedBy"/g)).toHaveLength(3);
    expect(html.match(/You<svg/g)).toHaveLength(2);
    expect(html.match(/>Guest</g)).toHaveLength(2);
  });

  it("ticks the chosen payer and sharers", () => {
    const html = form({ values: filled });
    expect(html).toContain('name="paidBy" checked="" value="b"');
    expect(html).not.toContain('name="paidBy" checked="" value="a"');
    expect(html).toContain('name="sharedBy" checked="" value="a"');
    expect(html).toContain('name="sharedBy" checked="" value="b"');
    expect(html).not.toContain('name="sharedBy" checked="" value="g"');
  });

  it("shows the typed values, the currency symbol and the six categories", () => {
    const html = form({ values: filled });
    expect(html).toContain('value="Dinner"');
    expect(html).toContain('value="1250.50"');
    expect(html).toContain('value="2027-05-09"');
    expect(html).toContain(">₱<");
    for (const label of ["No category", "Food", "Transport", "Lodging", "Activities", "Shopping", "Other"]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toMatch(/<option value="food" selected="">Food<\/option>/);
  });

  it("asks for decimals in pesos and whole amounts in a zero-decimal currency", () => {
    expect(form()).toContain('inputMode="decimal"');
    const vnd = form({ currency: "VND" });
    expect(vnd).toContain('inputMode="numeric"');
    expect(vnd).toContain(">₫<");
    expect(vnd).toContain('placeholder="250,000"');
  });

  it("carries the saved time when editing", () => {
    const html = form({ mode: "edit", updatedAt: "2027-05-09T10:00:00.123Z", values: filled });
    expect(html).toContain('name="mode" value="edit"');
    expect(html).toContain('name="updatedAt" value="2027-05-09T10:00:00.123Z"');
  });
});
