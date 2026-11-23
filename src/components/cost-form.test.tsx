import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CostForm } from "./cost-form";
import { emptyCostValues, type CostPerson } from "@/lib/cost-form-state";

// A static render can't run the server action, so a test that needs the state the server
// sends back (errors) sets `serverState`; every other test gets React's own hook.
const fake = vi.hoisted(() => ({ serverState: null as unknown }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: ((action: never, initial: never) =>
      fake.serverState ? [fake.serverState, () => {}, false] : actual.useActionState(action, initial)) as typeof actual.useActionState,
  };
});

vi.mock("@/app/trips/[tripId]/costs/actions", () => ({
  reviewOrSaveCostAction: async () => ({ errors: {}, values: {}, review: null, notice: null, updatedAt: "" }),
}));

const people: CostPerson[] = [
  { spotId: "a", userId: "u1", name: "Maya", image: null, isGuest: false, isYou: true, hasLeft: false },
  { spotId: "b", userId: "u2", name: "Ben", image: null, isGuest: false, isYou: false, hasLeft: false },
  { spotId: "g", userId: "g", name: "Dana", image: null, isGuest: true, isYou: false, hasLeft: false },
];

const filled = {
  description: "Dinner",
  amount: "1250.50",
  paidBy: "b",
  sharedBy: ["a", "b"],
  spentOn: "2027-05-09",
  category: "food",
  split: "equal",
  own: {},
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
    for (const name of ["description", "amount", "paidBy", "sharedBy", "split", "spentOn", "category", "tripId", "costId", "mode", "step", "updatedAt"]) {
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
    expect(html).toContain("Split between");
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

describe("CostForm, uneven split panel", () => {
  const items = {
    ...filled,
    amount: "1860",
    sharedBy: ["a", "b", "g"],
    split: "items",
    own: { a: "700", b: "", g: "300" },
  };

  it("starts closed on an equal split: a disclosure button, split=equal, no own boxes", () => {
    const html = form();
    expect(html).toContain("Not an even split? Add what each person had");
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toContain('name="split" value="equal"');
    expect(html).not.toContain('name="own:');
  });

  it("opens on load for an uneven cost, with one box per ticked person and split=items", () => {
    const html = form({ values: items });
    expect(html).toMatch(/aria-expanded="true"/);
    expect(html).toContain('name="split" value="items"');
    expect(html).not.toContain('name="split" value="equal"');
    expect(html.match(/name="own:/g)).toHaveLength(3);
    expect(html).toContain('name="own:a" value="700"');
    expect(html).toContain("Leave a box empty if they only share the rest.");
    expect(html).toContain("Your amount");
  });

  it("only offers a box to people who are ticked", () => {
    const html = form({ values: { ...items, sharedBy: ["a", "b"] } });
    expect(html.match(/name="own:/g)).toHaveLength(2);
    expect(html).not.toContain('name="own:g"');
  });

  it("shows the live helper: left over and the equal part, or over the total in red", () => {
    expect(form({ values: items })).toContain("₱860.00 left over, shared equally: ₱286.66 to ₱286.67 each<");
    expect(form({ values: { ...items, own: { a: "600", g: "300" } } })).toContain(
      "₱960.00 left over, shared equally: ₱320.00 each",
    );
    const over = form({ values: { ...items, own: { a: "1,000", g: "900" } } });
    expect(over).toContain("That&#x27;s ₱40.00 more than the total.");
    expect(over).toContain("text-owe");
    expect(form({ values: { ...items, amount: "1000.01", own: { a: "100" } } })).toContain(
      "₱900.01 left over, shared equally: ₱300.00 to ₱300.01 each<",
    );
  });

  it("says each person's part in VND, even and uneven", () => {
    const vnd = { ...items, amount: "100002", own: {} };
    expect(form({ values: vnd, currency: "VND" })).toContain("₫100,002 left over, shared equally: ₫33,334 each<");
    expect(form({ values: { ...vnd, amount: "100000" }, currency: "VND" })).toContain(
      "₫100,000 left over, shared equally: ₫33,333 to ₫33,334 each<",
    );
  });

  it("gives the own box a fixed width without w-full, so names keep their room", () => {
    const html = form({ values: items });
    const own = html.match(/<input[^>]*name="own:a"[^>]*>/)![0];
    expect(own).toContain("w-28");
    expect(own).toContain("shrink-0");
    expect(own).not.toContain("w-full");
    expect(html.match(/<input[^>]*name="description"[^>]*>/)![0]).toContain("w-full");
  });

  it("links the server's own-amount error to every box, so a screen reader reads it", () => {
    const message = "That's ₱40.00 more than the total.";
    fake.serverState = { errors: { own: message }, values: items, review: null, notice: null, updatedAt: "" };
    try {
      const html = form({ values: items });
      expect(html).toContain('id="own-error"');
      expect(html).toContain("That&#x27;s ₱40.00 more than the total.");
      expect(html.match(/aria-describedby="own-error"/g)).toHaveLength(3);
      expect(html.match(/name="own:[^"]*"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*name="own:/g)).toHaveLength(3);
    } finally {
      fake.serverState = null;
    }
    // Without an error the boxes are not marked.
    const clean = form({ values: items });
    expect(clean).not.toContain('aria-describedby="own-error"');
    expect(clean).not.toContain('id="own-error"');
  });
});

describe("CostForm, people who left", () => {
  const withLeft: CostPerson[] = [
    ...people,
    { spotId: "l", userId: "u3", name: "Lou", image: null, isGuest: false, isYou: false, hasLeft: true },
  ];

  it("tags a person who left in both pickers, and nobody else", () => {
    const html = form({ people: withLeft });
    expect(html.match(/>Left</g)).toHaveLength(2); // the payer radio and the share checkbox
    expect(form()).not.toContain(">Left<");
  });
});
