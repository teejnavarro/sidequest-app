import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CostsPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listCostsForMember: vi.fn(),
  getBalancesForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({
  listCostsForMember: mocks.listCostsForMember,
  getBalancesForMember: mocks.getBalancesForMember,
}));

type ContentProps = { params: Promise<{ tripId: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function render() {
  const page = CostsPage({
    params: Promise.resolve({ tripId: "trip-1" }),
  } as Parameters<typeof CostsPage>[0]) as ReactElement<{ children: ReactElement<ContentProps> }>;
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(content.props));
}

const trip = { id: "trip-1", currency: "PHP" };

let seq = 0;
const cost = (description: string, spentOn: string, extra = {}) => ({
  id: `cost-${++seq}`,
  description,
  amount: 100000,
  currency: "PHP",
  category: "food",
  spentOn,
  payer: { spotId: "a", name: "Maya", isGuest: false, isYou: false },
  shareCount: 3,
  myShare: 33334,
  addedBy: "Maya",
  editedBy: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.listCostsForMember.mockResolvedValue({ costs: [], total: 0 });
  mocks.getBalancesForMember.mockResolvedValue(balances(0));
});

const balances = (myNet: number, extra = {}) => ({
  people: [{ spotId: "s1", id: "u1", name: "Maya", image: null, isGuest: false, isYou: true, hasLeft: false, net: myNet }],
  payments: [],
  total: 125050,
  costCount: 2,
  ...extra,
});

describe("the Costs tab", () => {
  it("shows not found to someone who is not in the trip, and reads no costs", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.listCostsForMember).not.toHaveBeenCalled();
    expect(mocks.getBalancesForMember).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("says what to do first when there are no costs, with the Log a cost button", async () => {
    const html = await render();
    expect(html).toContain("No costs yet.");
    expect(html).toContain("Log the first one: who paid, and who shares it.");
    expect(html).toContain('href="/trips/trip-1/costs/new"');
    expect(html).toContain("Log a cost");
    expect(html).not.toContain("Your balance for this trip");
  });

  const twoCosts = () =>
    mocks.listCostsForMember.mockResolvedValue({
      costs: [cost("Dinner", "2027-05-09"), cost("Taxi", "2027-05-09", { amount: 25050 })],
      total: 125050,
    });

  it("shows what you are owed in green words, the total and the count, and the link", async () => {
    twoCosts();
    mocks.getBalancesForMember.mockResolvedValue(balances(277667));
    const html = await render();
    expect(html).toContain("Your balance for this trip");
    expect(html).toMatch(/text-owed[^>]*>You&#x27;re owed ₱2,776.67</);
    expect(html).toContain("₱1,250.50 logged in 2 costs");
    expect(html).toContain('href="/trips/trip-1/costs/balances"');
    expect(html).toContain("See who owes whom");
    expect(html).not.toContain("Logged so far");
  });

  it("shows what you owe in red words", async () => {
    twoCosts();
    mocks.getBalancesForMember.mockResolvedValue(balances(-110333));
    expect(await render()).toMatch(/text-owe[^>]*>You owe ₱1,103.33</);
  });

  it("says All settled with a check, and no color, when the balance is zero or you are not listed", async () => {
    twoCosts();
    for (const result of [balances(0), balances(0, { people: [] })]) {
      mocks.getBalancesForMember.mockResolvedValue(result);
      const html = await render();
      expect(html).toContain("All settled");
      expect(html).not.toMatch(/text-owed|text-owe[ "]/);
    }
  });

  it("says '1 cost' for one", async () => {
    mocks.listCostsForMember.mockResolvedValue({ costs: [cost("Dinner", "2027-05-09")], total: 100000 });
    mocks.getBalancesForMember.mockResolvedValue(balances(0, { total: 100000, costCount: 1 }));
    expect(await render()).toContain("₱1,000.00 logged in 1 cost<");
  });

  it("groups costs under their day, keeping the order it was given", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [cost("Souvenirs", "2027-05-10"), cost("Dinner", "2027-05-09"), cost("Taxi", "2027-05-09")],
      total: 300000,
    });
    const html = await render();
    expect(html.match(/<h2[^>]*>[^<]*<\/h2>/g)).toEqual([
      '<h2 class="pt-3 text-[13px] font-bold text-muted">Mon, May 10</h2>',
      '<h2 class="pt-3 text-[13px] font-bold text-muted">Sun, May 9</h2>',
    ]);
    expect(html.indexOf("Souvenirs")).toBeLessThan(html.indexOf("Dinner"));
    expect(html.indexOf("Dinner")).toBeLessThan(html.indexOf("Taxi"));
  });

  it("writes 'You' when the viewer paid, and the name otherwise", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [
        cost("Dinner", "2027-05-09", { payer: { spotId: "a", name: "Maya", isGuest: false, isYou: true } }),
        cost("Boat", "2027-05-09", { payer: { spotId: "g", name: "Dana", isGuest: true, isYou: false } }),
      ],
      total: 200000,
    });
    const html = await render();
    expect(html).toContain("You paid · split 3 ways");
    expect(html).toContain("Dana paid · split 3 ways");
  });

  it("says the payer left the trip, in muted text, only when they did", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [
        cost("Boat", "2027-05-09", { payer: { spotId: "l", name: "Lou", isGuest: false, isYou: false, hasLeft: true } }),
        cost("Dinner", "2027-05-09"),
      ],
      total: 200000,
    });
    const html = await render();
    expect(html).toContain('Lou<span class="text-muted"> (left the trip)</span> paid');
    expect(html.match(/left the trip/g)).toHaveLength(1);
  });

  it("shows the viewer's share, or that they are not in it", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [cost("Dinner", "2027-05-09"), cost("Taxi", "2027-05-09", { myShare: null, shareCount: 1 })],
      total: 200000,
    });
    const html = await render();
    expect(html).toContain("your share ₱333.34");
    expect(html).toContain("you&#x27;re not in this one");
    expect(html).toContain("split 1 way ·");
  });

  it("shows who added it, and who edited it only when someone else did", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [cost("Dinner", "2027-05-09"), cost("Taxi", "2027-05-09", { editedBy: "Ben" })],
      total: 200000,
    });
    const html = await render();
    expect(html).toContain("Added by Maya</span>");
    expect(html).toContain("Added by Maya · edited by Ben");
  });

  it("links each row to its Edit page and lets a long description wrap", async () => {
    mocks.listCostsForMember.mockResolvedValue({
      costs: [cost("Supercalifragilisticexpialidocious ".repeat(5), "2027-05-09")],
      total: 100000,
    });
    const html = await render();
    expect(html).toContain('href="/trips/trip-1/costs/cost-1/edit"');
    expect(html).toMatch(/wrap-anywhere">Supercalifragilistic/);
  });
});
