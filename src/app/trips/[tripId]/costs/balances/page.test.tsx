import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BalancesPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getBalancesForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({ getBalancesForMember: mocks.getBalancesForMember }));

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
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP" });
  mocks.getBalancesForMember.mockResolvedValue(example);
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
    expect(html).toContain("The fewest payments to make everyone even.");
    expect(html).toContain("Dana pays you");
    expect(html).toContain("Bea pays you");
    expect(html).toContain("Bea pays Jun");
    expect(html).toContain("₱2,083.34");
    expect(html).toContain("Paid someone back? Marking it here comes in a later update.");
    expect(html.indexOf("Bea pays you")).toBeLessThan(html.indexOf("Bea pays Jun"));
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
    expect(html).not.toContain("Paid someone back?");
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
