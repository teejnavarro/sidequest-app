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
  currency: "",
  fx: "rate",
  rate: "",
  charged: "",
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
    expect(html).toContain('<option value="PHP" selected="">₱ PHP</option>');
    for (const label of ["No category", "Food", "Transport", "Lodging", "Activities", "Shopping", "Other"]) {
      expect(html).toContain(`>${label}</option>`);
    }
    expect(html).toMatch(/<option value="food" selected="">Food<\/option>/);
  });

  it("asks for decimals in pesos and whole amounts in a zero-decimal currency", () => {
    expect(form()).toContain('inputMode="decimal"');
    const vnd = form({ currency: "VND" });
    expect(vnd).toContain('inputMode="numeric"');
    expect(vnd).toContain('<option value="VND" selected="">₫ VND</option>');
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

  it("shows the left-over error Save would give, not a part of 0 to 1 each", () => {
    const tiny = { ...items, amount: "2", own: {} };
    const html = form({ values: tiny, currency: "VND" });
    expect(html).toContain("₫2 left over can&#x27;t be shared by 3 people. Add it to someone&#x27;s amount.");
    expect(html).not.toContain("₫0 to ₫1 each");
    expect(html).toMatch(/bg-card text-owe">₫2 left over/);
  });

  it("names the person whose share would be 0, the way Save does", () => {
    const html = form({ values: { ...items, amount: "1000", own: { a: "1000" }, sharedBy: ["a", "b"] }, currency: "VND" });
    expect(html).toContain("Ben&#x27;s share comes to ₫0. Untick Ben or add an amount.");
  });

  it("gives one person in the split the whole leftover as their part", () => {
    const solo = { ...items, sharedBy: ["a"], amount: "1000", own: { a: "400" } };
    const html = form({ values: solo, currency: "VND" });
    expect(html.match(/name="own:/g)).toHaveLength(1);
    expect(html).toContain("₫600 left over, shared equally: ₫600 each<");
  });

  it("says nothing is left over when the own amounts use up the total", () => {
    const html = form({ values: { ...items, own: { a: "1000", b: "560", g: "300" } } });
    expect(html).toContain(">Nothing left over.<");
    expect(html).not.toContain("shared equally");
  });

  it("keeps a long name with its Guest and Left tags before the symbol, and the symbol can't shrink", () => {
    const crew: CostPerson[] = [
      ...people,
      { spotId: "c", userId: "c", name: "Christopher", image: null, isGuest: true, isYou: false, hasLeft: true },
    ];
    const html = form({ people: crew, values: { ...items, sharedBy: ["a", "c"] }, currency: "VND" });
    const panel = html.slice(html.indexOf('id="own-panel"'));
    const row = panel.slice(panel.indexOf("Christopher"), panel.indexOf('name="own:c"'));
    expect(row).toMatch(/^Christopher<span[^>]*>Guest<\/span><span[^>]*>Left<\/span><\/span>/);
    expect(row).toMatch(/<span aria-hidden="true" class="shrink-0[^"]*">₫<\/span><input/);
  });

  it("leaves every other box and dropdown full width", () => {
    const html = form({ values: items });
    expect(html.match(/<input[^>]*name="amount"[^>]*>/)![0]).toContain("flex-1");
    expect(html.match(/<select[^>]*name="category"[^>]*>/)![0]).toContain("w-full");
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

describe("CostForm, another currency", () => {
  const vnd = { ...filled, amount: "870000", currency: "VND", rate: "435" };

  it("shows no panel for the trip currency, and the select lists it first", () => {
    const html = form({ values: filled });
    expect(html).not.toContain("Use a rate");
    expect(html).not.toContain('id="rate"');
    expect(html).toContain('<select name="currency" aria-label="Currency"');
    expect(html.match(/<option value="[A-Z]{3}"/g)).toHaveLength(17);
    expect(html).toMatch(/<select name="currency"[^>]*>[^]*?<option value="PHP" selected="">/);
    // Hidden twins keep the four fields in the form either way.
    expect(html).toContain('name="fx" value="rate"');
  });

  it("opens the panel when another currency is picked, with a rate box and the live line", () => {
    const html = form({ values: vnd });
    expect(html).toContain('<option value="VND" selected="">₫ VND</option>');
    expect(html).toContain("Use a rate");
    expect(html).toContain("Card charged pesos");
    expect(html).toMatch(/name="fx"[^>]*checked=""[^>]*value="rate"|checked=""[^>]*name="fx"|name="fx" checked="" value="rate"/);
    expect(html).toContain("₱1 =");
    expect(html).toContain('name="rate"');
    expect(html).toContain('placeholder="435"');
    expect(html).toContain("That&#x27;s ₱2,000.00");
    expect(html).not.toContain('name="charged"');
  });

  it("shows the card amount box and what the rate works out to", () => {
    const html = form({ values: { ...vnd, amount: "3200000", fx: "charged", charged: "7412.60" } });
    expect(html).toContain("Pesos charged");
    expect(html).toContain("From your card or bank app.");
    expect(html).toContain('name="charged"');
    expect(html).not.toContain('name="rate"');
    expect(html).toContain("Works out to ₱1 = ₫431.70");
  });

  it("hides the live line while the boxes don't parse", () => {
    expect(form({ values: { ...vnd, rate: "" } })).not.toContain("That&#x27;s ₱");
    expect(form({ values: { ...vnd, rate: "abc" } })).not.toContain("That&#x27;s ₱");
  });

  it("names the trip currency in the panel when it is not pesos", () => {
    const html = form({ currency: "USD", values: { ...vnd, fx: "charged" } });
    expect(html).toContain("Card charged USD");
    expect(html).toContain("USD charged");
  });

  it("follows the picked currency in the amount placeholder and the own boxes", () => {
    const html = form({ values: { ...vnd, split: "items", own: { a: "300000" } } });
    expect(html).toContain('placeholder="250,000"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toMatch(/shrink-0 text-base font-bold text-muted">₫<\/span><input[^>]*name="own:a"/);
  });

  it("carries all four fields in the review's hidden inputs", () => {
    const values = { ...vnd, fx: "charged", charged: "7412.60" };
    const review = {
      kind: "new", currency: "PHP", description: "Dinner", amount: 741260, original: null, category: null,
      spentOn: "2027-05-09", payer: { spotId: "b", name: "Ben", isYou: false },
      shares: [{ spotId: "a", name: "Maya", isYou: true, amount: 741260, originalAmount: null, own: null }],
      uneven: false, rest: 741260, extraTakers: [], changes: [], shareChanges: [],
    };
    fake.serverState = { errors: {}, values, review, notice: null, updatedAt: "" };
    try {
      const html = form({ values });
      expect(html).toContain('name="currency" value="VND"');
      expect(html).toContain('name="fx" value="charged"');
      expect(html).toContain('name="rate" value="435"');
      expect(html).toContain('name="charged" value="7412.60"');
    } finally {
      fake.serverState = null;
    }
  });

  it("links a rate or card amount error to its box", () => {
    fake.serverState = { errors: { rate: "That's too large." }, values: vnd, review: null, notice: null, updatedAt: "" };
    try {
      const html = form({ values: vnd });
      expect(html).toContain('id="rate-error"');
      expect(html).toContain('aria-describedby="rate-error"');
    } finally {
      fake.serverState = null;
    }
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

// SQ-035: the receipt photo picker stays mounted through the review step and is tied to
// whichever form is showing by id, so the picked file is still posted with Save. A static
// render can't pick a file, so this checks the structure that makes it work.
describe("CostForm, receipt photo", () => {
  const inputsOf = (html: string) => html.match(/<input[^>]*name="(?:photo|photoAction)"[^>]*>/g) ?? [];
  const review = {
    kind: "new", currency: "PHP", description: "Dinner", amount: 100000, original: null, category: null,
    spentOn: "2027-05-09", payer: { spotId: "a", name: "Maya", isYou: true },
    shares: [{ spotId: "a", name: "Maya", isYou: true, amount: 100000, originalAmount: null, own: null }],
    uneven: false, withPhoto: true, rest: 100000, extraTakers: [], changes: [], shareChanges: [],
  };

  it("offers an optional receipt photo with its help line, once, tied to the form by id", () => {
    const html = form();
    expect(html).toContain("Receipt photo (optional)");
    expect(html).toContain("Add a receipt photo");
    expect(html).toContain("Everyone in this trip can see it.");
    expect(inputsOf(html)).toHaveLength(2);
    for (const input of inputsOf(html)) expect(input).toContain('form="cost-form"');
    expect(html).toContain('name="photoAction"');
    expect(html).toContain('value="keep"');
    expect(html.match(/<form /g)).toHaveLength(1);
    expect(html).toContain('<form id="cost-form"');
    expect(html).toMatch(/<button type="submit" form="cost-form"[^>]*>Review<\/button>/);
  });

  it("keeps the picker mounted but hidden while the review shows, with the same form id", () => {
    fake.serverState = { errors: {}, values: { ...emptyCostValues, paidBy: "a", sharedBy: ["a"] }, review, notice: null, updatedAt: "" };
    try {
      const html = form();
      expect(html).toContain("Check this cost");
      expect(html).toContain('<form id="cost-form"');
      expect(inputsOf(html)).toHaveLength(2);
      for (const input of inputsOf(html)) expect(input).toContain('form="cost-form"');
      expect(html).toMatch(/<div class="hidden"><span[^>]*>Receipt photo \(optional\)/);
      expect(html).toContain("With a receipt photo.");
      expect(html).not.toContain(">Review</button>");
    } finally {
      fake.serverState = null;
    }
  });

  it("shows the saved photo as a preview on an edit, from the checked route and never a storage path", () => {
    const html = form({ mode: "edit", photoSrc: "/trips/trip-1/costs/cost-1/photo" });
    expect(html).toContain('src="/trips/trip-1/costs/cost-1/photo"');
    expect(html).toContain('alt="Receipt photo"');
    expect(html).toContain(">Change<");
    expect(html).toContain(">Remove<");
    expect(html).not.toContain("cost-photos/");
    expect(form()).not.toContain(">Remove<");
  });
});
