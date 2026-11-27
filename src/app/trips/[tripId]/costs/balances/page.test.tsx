import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BalancesPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getBalancesForMember: vi.fn(),
  listCostsForMember: vi.fn(),
  listPaymentsForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({
  getBalancesForMember: mocks.getBalancesForMember,
  listCostsForMember: mocks.listCostsForMember,
}));
vi.mock("@/lib/payments", () => ({ listPaymentsForMember: mocks.listPaymentsForMember }));

type ContentProps = { params: Promise<{ tripId: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function render() {
  const page = BalancesPage({
    params: Promise.resolve({ tripId: "trip-1" }),
  } as Parameters<typeof BalancesPage>[0]) as ReactElement<{ children: ReactElement<ContentProps> }>;
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(content.props));
}

const person = (spotId: string, name: string, net: number, extra = {}) => ({
  spotId,
  id: `id-${spotId}`,
  name,
  image: null,
  isGuest: false,
  isYou: false,
  hasLeft: false,
  net,
  ...extra,
});

// The hand-worked example, seen by Maya.
const example = {
  people: [
    person("maya", "Maya", 277667, { isYou: true }),
    person("bea", "Bea", -110333),
    person("jun", "Jun", 41000),
    person("dana", "Dana", -208334, { isGuest: true }),
  ],
  payments: [
    { from: "bea", to: "maya", amount: 69333 },
    { from: "bea", to: "jun", amount: 41000 },
    { from: "dana", to: "maya", amount: 208334 },
  ],
  total: 1306000,
  costCount: 6,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP", timeZone: "Asia/Manila" });
  mocks.getBalancesForMember.mockResolvedValue(example);
  mocks.listPaymentsForMember.mockResolvedValue([]);
  mocks.listCostsForMember.mockResolvedValue({ costs: [], total: 0, trashCount: 0 });
});

const spot = (spotId: string, name: string, extra = {}) => ({
  spotId,
  name,
  isGuest: false,
  hasLeft: false,
  isYou: false,
  ...extra,
});

const paid = (id: string, from: ReturnType<typeof spot>, to: ReturnType<typeof spot>, extra = {}) => ({
  id,
  from,
  to,
  amount: 30000,
  currency: "PHP",
  method: "gcash",
  createdAt: new Date("2026-11-24T06:05:00Z"),
  mine: false,
  hasReceipt: false,
  ...extra,
});

describe("the Balances page", () => {
  it("shows not found to someone who is not in the trip, and reads no balances", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.getBalancesForMember).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("has a band back to Costs", async () => {
    const html = await render();
    expect(html).toContain('href="/trips/trip-1/costs"');
    expect(html).toContain(">Balances</h1>");
  });

  it("lists the viewer's payments first, in plain words", async () => {
    const html = await render();
    expect(html).toContain("Settle up");
    expect(html).toContain(
      "The fewest payments to make everyone even, so you might pay someone who didn&#x27;t pay for your cost. Tap one to see how to pay.",
    );
    expect(html).toContain("Dana pays you");
    expect(html).toContain("Bea pays you");
    expect(html).toContain("Bea pays Jun");
    expect(html).toContain("₱2,083.34");
    expect(html).not.toContain("comes in a later update");
    expect(html.indexOf("Bea pays you")).toBeLessThan(html.indexOf("Bea pays Jun"));
  });

  it("makes every settle-up line a link to its Pay page", async () => {
    const html = await render();
    expect(html).toContain('href="/trips/trip-1/costs/pay/bea/maya"');
    expect(html).toContain('href="/trips/trip-1/costs/pay/bea/jun"');
    expect(html).toContain('href="/trips/trip-1/costs/pay/dana/maya"');
  });

  it("shows no Payments card when nothing was paid back", async () => {
    expect(await render()).not.toContain("aria-label=\"Payments\"");
  });

  it("lists recorded payments newest first, in the trip time zone, with receipts only when the viewer may see them", async () => {
    mocks.listPaymentsForMember.mockResolvedValue([
      paid("p1", spot("maya", "Maya", { isYou: true }), spot("bea", "Bea"), { mine: true, hasReceipt: true }),
      paid("p2", spot("bea", "Bea"), spot("maya", "Maya", { isYou: true }), { mine: true, method: "cash", amount: 45000 }),
      paid("p3", spot("bea", "Bea"), spot("jun", "Jun"), { method: "bank", amount: 20000 }),
    ]);
    const html = await render();
    const card = html.slice(html.indexOf('aria-label="Payments"'));
    expect(card).toContain("You paid Bea");
    expect(card).toContain("Bea paid you");
    expect(card).toContain("Bea paid Jun");
    expect(card).toContain("GCash · Tue, Nov 24");
    expect(card).toContain("Cash · Tue, Nov 24");
    expect(card).toContain("Bank · Tue, Nov 24");
    expect(card).toContain("₱300.00");
    expect(card.match(/Receipt/g)).toHaveLength(1);
    expect(card.indexOf("You paid Bea")).toBeLessThan(card.indexOf("Bea paid Jun"));
    // Only the viewer's own payments are links.
    expect(card).toContain('href="/trips/trip-1/costs/payments/p1"');
    expect(card).toContain('href="/trips/trip-1/costs/payments/p2"');
    expect(card).not.toContain("/costs/payments/p3");
  });

  it("marks a payer who left, and still draws a face for them", async () => {
    mocks.listPaymentsForMember.mockResolvedValue([
      paid("p9", spot("gone", "Lou", { hasLeft: true }), spot("maya", "Maya", { isYou: true }), { mine: true }),
    ]);
    const html = await render();
    expect(html).toContain('Lou<span class="text-muted"> (left the trip)</span> paid you');
  });

  it("puts the viewer's own payments before the others, and says 'You pay' when the viewer pays", async () => {
    mocks.getBalancesForMember.mockResolvedValue({
      ...example,
      people: [person("maya", "Maya", -5000, { isYou: true }), person("bea", "Bea", 5000 - 3000), person("jun", "Jun", -3000 + 3000)],
      payments: [
        { from: "jun", to: "bea", amount: 1 },
        { from: "maya", to: "bea", amount: 5000 },
      ],
    });
    const html = await render();
    expect(html.indexOf("You pay Bea")).toBeLessThan(html.indexOf("Jun pays Bea"));
  });

  it("lists everyone, the viewer first, and colors only the viewer's own line", async () => {
    const html = await render();
    const section = html.slice(html.indexOf("Everyone&#x27;s balance</h2>"));
    expect(section.indexOf(">You<")).toBeLessThan(section.indexOf(">Bea<"));
    expect(section).toContain("You&#x27;re owed");
    expect(section).toContain("is owed");
    expect(section).toContain("owes");
    expect(section).toContain("Guest");
    expect(section.match(/text-owed/g)).toHaveLength(2);
    expect(section).toContain("text-owed");
    expect(section).not.toContain("text-owe ");
    expect(section).not.toMatch(/text-owe[^d]/);
  });

  it("colors the viewer's line red with words when they owe", async () => {
    mocks.getBalancesForMember.mockResolvedValue({
      ...example,
      people: [person("maya", "Maya", -100, { isYou: true }), person("bea", "Bea", 100)],
      payments: [{ from: "maya", to: "bea", amount: 100 }],
    });
    const html = await render();
    expect(html).toContain("You owe");
    expect(html).toMatch(/text-owe[ "]/);
  });

  it("marks a person who left, in muted text", async () => {
    mocks.getBalancesForMember.mockResolvedValue({
      ...example,
      people: example.people.map((p) => (p.spotId === "bea" ? { ...p, hasLeft: true } : p)),
    });
    const html = await render();
    expect(html).toContain('Bea<span class="text-muted"> (left the trip)</span> pays you');
    expect(html.match(/left the trip/g)).toHaveLength(3);
  });

  it("marks a person who left when they are the one being paid, and shows no amount for a settled viewer", async () => {
    mocks.getBalancesForMember.mockResolvedValue({
      ...example,
      people: [
        person("maya", "Maya", 0, { isYou: true }),
        person("lou", "Lou", 2500, { hasLeft: true }),
        person("jun", "Jun", -2500),
      ],
      payments: [{ from: "jun", to: "lou", amount: 2500 }],
    });
    const html = await render();
    expect(html).toContain('Jun pays Lou<span class="text-muted"> (left the trip)</span>');
    expect(html).toContain("₱25.00");
    const section = html.slice(html.indexOf("Everyone&#x27;s balance</h2>"));
    const viewerRow = section.slice(section.indexOf(">You<"), section.indexOf("</li>"));
    expect(viewerRow).toContain("are settled");
    expect(viewerRow).not.toContain("₱");
  });

  it("says everyone is even when nothing is owed", async () => {
    mocks.getBalancesForMember.mockResolvedValue({
      people: [person("maya", "Maya", 0, { isYou: true }), person("bea", "Bea", 0)],
      payments: [],
      total: 400000,
      costCount: 2,
    });
    const html = await render();
    expect(html).toContain("Everyone&#x27;s even. Nothing to pay.");
    expect(html).toContain("are settled");
    expect(html).toContain("is settled");
    expect(html).not.toContain("comes in a later update");
  });

  it("says there are no costs yet, with a link back to Costs and no amber button", async () => {
    mocks.getBalancesForMember.mockResolvedValue({ people: [person("maya", "Maya", 0, { isYou: true })], payments: [], total: 0, costCount: 0 });
    const html = await render();
    expect(html).toContain("No costs yet.");
    expect(html).toContain("Back to Costs");
    expect(html).not.toContain("bg-amber");
    expect(html).not.toContain("Settle up");
  });

  it("never prints an email", async () => {
    expect(await render()).not.toContain("@");
  });
});

// The tester case with made-up names: Lunch 3,802.00 paid by Dan and Photoshoot 250.00 paid
// by Cara, each split four ways between Ana, Ben, Cara and Dan.
describe("How your balance adds up", () => {
  const who = (name: string, viewer: string) => ({ spotId: name, name, isGuest: false, isYou: name === viewer, hasLeft: false });
  const costsSeenBy = (viewer: string) => ({
    costs: [
      { id: "shoot", description: "Photoshoot", amount: 25000, currency: "PHP", category: "activities", spentOn: "2026-11-08", payer: who("Cara", viewer), myShare: 6250 },
      { id: "lunch", description: "Lunch", amount: 380200, currency: "PHP", category: "food", spentOn: "2026-11-07", payer: who("Dan", viewer), myShare: 95050 },
    ],
    total: 405200,
    trashCount: 0,
  });
  const card = (html: string) => {
    const at = html.indexOf('aria-label="How your balance adds up"');
    return at < 0 ? "" : html.slice(at, html.indexOf("</section>", at));
  };
  const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replaceAll("&#x27;", "'");

  it("shows Ana what each cost adds and the total, under Settle up and above Everyone's balance", async () => {
    mocks.listCostsForMember.mockResolvedValue(costsSeenBy("Ana"));
    const html = await render();
    const words = text(card(html));
    expect(words).toContain("How your balance adds up");
    expect(words).toContain("Lunch Dan paid ₱3,802.00 · Nov 7 you owe ₱950.50");
    expect(words).toContain("Photoshoot Cara paid ₱250.00 · Nov 8 you owe ₱62.50");
    expect(words).toContain("Your balance You owe ₱1,013.00");
    expect(html.indexOf('aria-label="Settle up"')).toBeLessThan(html.indexOf('aria-label="How your balance adds up"'));
    expect(html.indexOf('aria-label="How your balance adds up"')).toBeLessThan(html.indexOf('aria-label="Everyone'));
  });

  it("shows Cara what she is owed for the cost she paid", async () => {
    mocks.listCostsForMember.mockResolvedValue(costsSeenBy("Cara"));
    const words = text(card(await render()));
    expect(words).toContain("You paid ₱250.00 · Nov 8 owed to you ₱187.50");
    expect(words).toContain("Lunch Dan paid ₱3,802.00 · Nov 7 you owe ₱950.50");
    expect(words).toContain("You owe ₱763.00");
  });

  it("links each cost line to its breakdown page", async () => {
    mocks.listCostsForMember.mockResolvedValue(costsSeenBy("Ana"));
    const html = card(await render());
    expect(html).toContain('href="/trips/trip-1/costs/lunch"');
    expect(html).toContain('href="/trips/trip-1/costs/shoot"');
  });

  it("lists payments sent and got back, and counts them in the total", async () => {
    mocks.listCostsForMember.mockResolvedValue(costsSeenBy("Ana"));
    mocks.listPaymentsForMember.mockResolvedValue([
      paid("p1", who("Ana", "Ana"), who("Dan", "Ana"), { amount: 50000, mine: true }),
      paid("p2", who("Ben", "Ana"), who("Ana", "Ana"), { amount: 20000, mine: true, method: "cash" }),
      paid("p3", who("Ben", "Ana"), who("Dan", "Ana")),
    ]);
    const words = text(card(await render()));
    expect(words).toContain("Payments");
    expect(words).toContain("You paid Dan GCash · Tue, Nov 24 paid back ₱500.00");
    expect(words).toContain("Ben paid you Cash · Tue, Nov 24 got back ₱200.00");
    expect(words).not.toContain("Ben paid Dan");
    expect(words).toContain("You owe ₱713.00"); // 1,013.00 - 500.00 + 200.00
  });

  it("leaves the card out when the viewer has no lines", async () => {
    expect(await render()).not.toContain("How your balance adds up");
  });

  it("marks a cost's payer who left the trip, and no one else", async () => {
    const seen = costsSeenBy("Ana");
    seen.costs[1] = { ...seen.costs[1], payer: { ...who("Dan", "Ana"), hasLeft: true } };
    mocks.listCostsForMember.mockResolvedValue(seen);
    const words = text(card(await render()));
    expect(words).toContain("Lunch Dan (left the trip) paid ₱3,802.00 · Nov 7 you owe ₱950.50");
    expect(words).toContain("Photoshoot Cara paid ₱250.00");
    expect(words.match(/left the trip/g)).toHaveLength(1);
  });

  it("leaves out a cost in another currency, from the lines and the total", async () => {
    const seen = costsSeenBy("Ana");
    seen.costs.push({ id: "pho", description: "Pho stall", amount: 2000000, currency: "VND", category: "food", spentOn: "2026-11-09", payer: who("Dan", "Ana"), myShare: 500000 });
    mocks.listCostsForMember.mockResolvedValue(seen);
    const html = card(await render());
    const words = text(html);
    expect(words).toContain("Lunch Dan paid ₱3,802.00");
    expect(words).not.toContain("Pho stall");
    expect(html).not.toContain('href="/trips/trip-1/costs/pho"');
    expect(words).toContain("Your balance You owe ₱1,013.00");
  });

  it("shows All settled when the lines add up to nothing", async () => {
    mocks.listCostsForMember.mockResolvedValue(costsSeenBy("Ana"));
    mocks.listPaymentsForMember.mockResolvedValue([paid("p1", who("Ana", "Ana"), who("Dan", "Ana"), { amount: 101300, mine: true })]);
    expect(text(card(await render()))).toContain("Your balance All settled");
  });
});
