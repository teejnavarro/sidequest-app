import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CostReviewView } from "./cost-review";
import type { CostReview } from "@/lib/cost-form-state";

const maya = { spotId: "a", name: "Maya", isYou: true };
const ben = { spotId: "b", name: "Ben", isYou: false };
const dana = { spotId: "g", name: "Dana", isYou: false };

const base: CostReview = {
  kind: "new",
  currency: "PHP",
  description: "Dinner",
  amount: 300000,
  original: null,
  category: "food",
  spentOn: "2027-05-09",
  payer: ben,
  shares: [
    { ...maya, amount: 100000, originalAmount: null, own: null },
    { ...ben, amount: 100000, originalAmount: null, own: null },
    { ...dana, amount: 100000, originalAmount: null, own: null },
  ],
  uneven: false,
  withPhoto: false,
  rest: 300000,
  extraTakers: [],
  changes: [],
  shareChanges: [],
};

const html = (review: CostReview) => renderToStaticMarkup(<CostReviewView review={review} />);

describe("CostReviewView, new cost", () => {
  it("summarises who paid, the split and the share each when it is even", () => {
    const out = html(base);
    expect(out).toContain("Check this cost");
    expect(out).toContain("Ben paid ₱3,000.00, split 3 ways = ₱1,000.00 each");
    expect(out).toContain("Dinner");
    expect(out).toContain("Food");
    expect(out).toContain("Sun, May 9");
    expect(out).not.toContain("doesn&#x27;t split evenly");
  });

  it("writes You for the viewer, one line per person and a total", () => {
    const out = html({ ...base, payer: maya });
    expect(out).toContain("You paid ₱3,000.00");
    expect(out).toMatch(/>You<\/span><\/span><span[^>]*>₱1,000\.00<\/span>/);
    expect(out).toContain(">Dana<");
    expect(out).toContain(">Total<");
  });

  it("explains an uneven split and who takes the extra centavo", () => {
    const out = html({
      ...base,
      amount: 100000,
      payer: maya,
      shares: [
        { ...maya, amount: 33334, originalAmount: null, own: null },
        { ...ben, amount: 33333, originalAmount: null, own: null },
        { ...dana, amount: 33333, originalAmount: null, own: null },
      ],
      extraTakers: [maya],
    });
    expect(out).toContain("You paid ₱1,000.00, split 3 ways");
    expect(out).not.toContain("each</p>");
    expect(out).toContain(
      "₱1,000.00 doesn&#x27;t split evenly 3 ways, so You take the extra centavo. The shares always add up to the total.",
    );
  });

  it("names a taker other than the viewer, and several takers", () => {
    const one = html({ ...base, amount: 100000, extraTakers: [ben] });
    expect(one).toContain("so Ben takes the extra centavo");
    const two = html({ ...base, amount: 5, extraTakers: [maya, ben] });
    expect(two).toContain("so You and Ben each take one extra centavo");
  });

  it("uses the currency's own unit and no decimals for a zero-decimal currency", () => {
    const out = html({ ...base, currency: "VND", amount: 1000, extraTakers: [ben], shares: base.shares });
    expect(out).toContain("₫1,000");
    expect(out).not.toContain("₫1,000.00");
    expect(out).toContain("takes the extra dong");
  });
});

describe("CostReviewView, receipt photo", () => {
  it("says a new cost is saved with a receipt photo, only when it is", () => {
    expect(html({ ...base, withPhoto: true })).toContain("With a receipt photo.");
    expect(html(base)).not.toContain("With a receipt photo.");
  });

  it("shows the photo as a changed field on an edit", () => {
    const edit: CostReview = { ...base, kind: "edit", changes: [{ field: "photo", before: "None", after: "Added" }] };
    const out = html(edit);
    expect(out).toContain("Receipt photo");
    expect(out).toContain("None");
    expect(out).toContain("Added");
    expect(out).not.toContain("Nothing changed.");
  });
});

describe("CostReviewView, uneven split", () => {
  const uneven: CostReview = {
    ...base,
    amount: 186000,
    payer: ben,
    uneven: true,
    rest: 36000,
    shares: [
      { ...maya, amount: 79000, originalAmount: null, own: 70000 },
      { ...ben, amount: 9000, originalAmount: null, own: 0 },
      { ...dana, amount: 39000, originalAmount: null, own: 30000 },
    ],
  };

  it("says own plus shared under each name, and no 'each' in the summary", () => {
    const out = html(uneven);
    expect(out).toContain("Ben paid ₱1,860.00, split 3 ways");
    expect(out).not.toContain("= ₱");
    expect(out).toContain("₱700.00 own + ₱90.00 shared");
    expect(out).toContain(">₱90.00 shared<");
    expect(out).toContain("₱300.00 own + ₱90.00 shared");
    expect(out).toContain(">₱790.00<");
    expect(out).not.toContain("doesn&#x27;t split evenly");
  });

  it("explains the extra centavo from the left-over part only", () => {
    const out = html({ ...uneven, rest: 36001, extraTakers: [ben] });
    expect(out).toContain(
      "₱360.01 left over doesn&#x27;t split evenly 3 ways, so Ben takes the extra centavo. The shares always add up to the total.",
    );
  });

  it("shows nothing extra on an equal split", () => {
    expect(html(base)).not.toContain(" own + ");
    expect(html(base)).not.toContain(" shared<");
  });
});

describe("CostReviewView, edit", () => {
  const edit: CostReview = { ...base, kind: "edit" };

  it("shows only the changed fields, old value struck through, then the new one", () => {
    const out = html({
      ...edit,
      changes: [{ field: "amount", before: "₱3,000.00", after: "₱3,500.00" }],
    });
    expect(out).toContain("Check your changes");
    expect(out).toContain("Amount");
    expect(out).toContain("<s class=\"text-muted\">₱3,000.00</s>");
    expect(out).toContain("₱3,500.00");
    expect(out).toContain("Nothing else changed.");
    expect(out).not.toContain("Category");
    expect(out).not.toContain(">Total<");
  });

  it("shows each share that changed, including people added or taken out", () => {
    const out = html({
      ...edit,
      shareChanges: [
        { person: maya, before: 100000, after: 116667 },
        { person: ben, before: 100000, after: null },
        { person: dana, before: null, after: 116666 },
      ],
    });
    expect(out).toContain("Your share");
    expect(out).toContain("Ben&#x27;s share");
    expect(out).toContain("not in it");
    expect(out).toContain("₱1,166.67");
  });

  it("says nothing changed when nothing did", () => {
    const out = html(edit);
    expect(out).toContain("Nothing changed.");
    expect(out).not.toContain("Nothing else changed.");
  });
});

describe("CostReviewView, another currency", () => {
  const shares = (originals: number[], own: (number | null)[] = [null, null, null]) =>
    [maya, ben, dana].map((person, i) => ({
      ...person,
      amount: [66667, 66667, 66666][i]!,
      originalAmount: originals[i]!,
      own: own[i]!,
    }));
  const vnd: CostReview = {
    ...base,
    amount: 200000,
    original: { currency: "VND", amount: 870000, rate: "435", effectiveRate: "435.00" },
    shares: shares([290000, 290000, 290000]),
    rest: 870000,
  };

  it("adds a muted line with the original amount and the rate", () => {
    expect(html(vnd)).toContain("₫870,000 at ₱1 = ₫435");
  });

  it("says the card amount and the rate it works out to when no rate was typed", () => {
    const out = html({
      ...vnd,
      amount: 741260,
      original: { currency: "VND", amount: 3200000, rate: null, effectiveRate: "431.70" },
    });
    expect(out).toContain("₫3,200,000, card charged ₱7,412.60 (₱1 = ₫431.70)");
  });

  it("shows each share's original under their name and the original total", () => {
    const out = html(vnd);
    expect(out).toContain("₫290,000</span>");
    expect(out).toMatch(/Total<span[^>]*>₫870,000<\/span>/);
    expect(out).toContain("₱666.67");
  });

  it("shows own plus shared in the original currency on an uneven split", () => {
    const out = html({
      ...vnd,
      uneven: true,
      rest: 270000,
      shares: shares([367500, 267500, 235000], [300000, 200000, 0]),
    });
    expect(out).toContain("₫300,000 own + ₫67,500 shared");
    expect(out).toContain("₫67,500 shared");
  });

  it("explains the extra unit in the original currency", () => {
    const out = html({
      ...vnd,
      original: { currency: "VND", amount: 100002, rate: "435", effectiveRate: "435.00" },
      shares: shares([33334, 33334, 33334]),
      extraTakers: [ben],
    });
    expect(out).toContain("₫100,002 doesn&#x27;t split evenly 3 ways, so Ben takes the extra dong.");
  });

  it("leaves a trip-currency cost without any original line", () => {
    const out = html(base);
    expect(out).not.toContain("card charged");
    expect(out).not.toContain(" at ₱1");
  });

  it("lists a changed amount in dong, the pesos and the rate on an edit", () => {
    const out = html({
      ...vnd,
      kind: "edit",
      changes: [
        { field: "amount", before: "₫870,000", after: "₫900,000" },
        { field: "main", before: "₱2,000.00", after: "₱2,068.97" },
        { field: "rate", before: "₱1 = ₫435", after: "₱1 = ₫435" },
      ],
    });
    expect(out).toContain("Amount in PHP");
    expect(out).toContain("₫870,000");
    expect(out).toContain("₫900,000");
    expect(out).toContain("₱2,068.97");
  });
});
