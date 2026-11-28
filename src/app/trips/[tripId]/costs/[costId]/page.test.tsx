import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CostPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUserForPage: vi.fn(),
  getTripForMember: vi.fn(),
  getCostBreakdownForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserForPage: mocks.getCurrentUserForPage }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({ getCostBreakdownForMember: mocks.getCostBreakdownForMember }));
vi.mock("@/app/trips/[tripId]/costs/actions", () => ({ addCostPhotoAction: async () => ({}) }));

type ContentProps = { params: Promise<{ tripId: string; costId: string }> };

// The page is a Suspense wrapper around an async content component: run the content directly.
async function renderPage() {
  const page = (CostPage as unknown as (p: unknown) => ReactElement<{ children: ReactElement<ContentProps> }>)({
    params: Promise.resolve({ tripId: "trip-1", costId: "c1" }),
  });
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  // renderToStaticMarkup escapes apostrophes; the words are easier to read without that.
  return renderToStaticMarkup(await run(content.props)).replaceAll("&#x27;", "'");
}

// The tester case with made-up names: Lunch 3,802.00 paid by Dan, split four ways. The viewer
// is Ana (user u1) unless a test says otherwise.
const person = (name: string, extra: Record<string, unknown> = {}) => ({
  spotId: `spot-${name}`,
  id: `user-${name}`,
  name,
  image: null,
  isGuest: false,
  isYou: false,
  hasLeft: false,
  ...extra,
});
const [ana, ben, cara, dan] = [person("Ana", { isYou: true }), person("Ben"), person("Cara"), person("Dan")];
const share = (p: ReturnType<typeof person>, amount = 95050, originalAmount: number | null = null) => ({ ...p, amount, originalAmount });

const lunch = {
  id: "c1",
  description: "Lunch",
  amount: 380200,
  currency: "PHP",
  category: "food",
  spentOn: "2026-11-26",
  original: null,
  paidBy: dan.spotId,
  payer: dan,
  shares: [share(ana), share(ben), share(cara), share(dan)],
  addedBy: { name: "Ben", isYou: false },
  createdAt: new Date("2026-11-27T12:40:00Z"),
  editedBy: null,
  updatedAt: new Date("2026-11-27T12:40:00Z"),
  photo: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUserForPage.mockResolvedValue({ id: "u1", name: "Ana Reyes", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP", timeZone: "Asia/Manila" });
  mocks.getCostBreakdownForMember.mockResolvedValue(lunch);
});

describe("the Cost page access", () => {
  it("shows not found when the cost or the trip is missing, asking with the trip, cost and user", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("not-found");
    mocks.getCostBreakdownForMember.mockResolvedValue(lunch);
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("not-found");
    expect(mocks.getCostBreakdownForMember).toHaveBeenCalledWith("trip-1", "c1", "u1");
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUserForPage.mockRejectedValue(new Error("redirect:/"));
    await expect(renderPage()).rejects.toThrow("redirect:/");
    expect(mocks.getCostBreakdownForMember).not.toHaveBeenCalled();
  });
});

describe("the Cost page", () => {
  it("shows the cost, who paid and each share, with the viewer first and the payer's share last", async () => {
    const html = await renderPage();
    expect(html).toContain(">Cost</h1>");
    expect(html).toContain("Lunch");
    expect(html).toContain("₱3,802.00");
    expect(html).toContain("Thu, Nov 26 · Food");
    expect(html).toContain("Dan paid ₱3,802.00");
    const order = ["You owe", "Ben owes", "Cara owes", "Dan's share"].map((words) => html.indexOf(words));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("₱950.50");
    expect(html).not.toContain("Ana owes");
    expect(html).not.toContain("You&#x27;re not in this one");
    expect(html).not.toContain("Not an even split");
  });

  it("says You paid and Your share when the viewer paid", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...lunch,
      paidBy: ana.spotId,
      payer: ana,
      shares: [share(ana), share(ben), share(cara), share(dan)],
    });
    const html = await renderPage();
    expect(html).toContain("You paid ₱3,802.00");
    expect(html).toContain("Your share");
    expect(html).not.toContain("You owe");
    expect(html).toContain("Ben owes");
  });

  it("says so when the viewer is not in the cost", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({ ...lunch, shares: [share(ben, 126733), share(cara, 126733), share(dan, 126734)] });
    const html = await renderPage();
    expect(html).toContain("You're not in this one.");
    expect(html).not.toContain("You owe");
  });

  it("tags an uneven split and leaves an even one alone", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...lunch,
      shares: [share(ana, 100000), share(ben, 100000), share(cara, 100000), share(dan, 80200)],
    });
    expect(await renderPage()).toContain("Not an even split");
    mocks.getCostBreakdownForMember.mockResolvedValue(lunch);
    expect(await renderPage()).not.toContain("Not an even split");
  });

  it("shows each person's own amount on an uneven split, adding up to the total to the centavo", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...lunch,
      shares: [share(ana, 120000), share(ben, 100000), share(cara, 80000), share(dan, 80200)],
    });
    const html = await renderPage();
    const rows = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((row) => row[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    // Each row also holds the face's initial, so match the words and amount at the end.
    expect(rows).toEqual(["You owe ₱1,200.00", "Ben owes ₱1,000.00", "Cara owes ₱800.00", "Dan's share ₱802.00"].map((words) => expect.stringMatching(new RegExp(`${words}$`))));
    const centavos = rows.map((row) => Math.round(Number(row.split("₱")[1].replaceAll(",", "")) * 100));
    expect(centavos.reduce((sum, amount) => sum + amount, 0)).toBe(380200);
    expect(html).toContain("Dan paid ₱3,802.00");
  });

  it("shows a foreign cost on one line, with the rate or without it", async () => {
    const foreign = {
      ...lunch,
      amount: 459770,
      category: null,
      original: { amount: 2000000, currency: "VND", rate: "435" },
      paidBy: ben.spotId,
      payer: ben,
      shares: [share(ana, 229885, 1000000), share(ben, 229885, 1000000)],
    };
    mocks.getCostBreakdownForMember.mockResolvedValue(foreign);
    const html = await renderPage();
    expect(html).toContain("₫2,000,000 at ₱1 = ₫435 · ₱4,597.70");
    expect(html).toContain("₫1,000,000");
    expect(html).toContain("Thu, Nov 26<");
    expect(html).not.toContain("Not an even split");
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...foreign,
      amount: 462000,
      original: { amount: 2000000, currency: "VND", rate: null },
      shares: [share(ana, 231000, 1000000), share(ben, 231000, 1000000)],
    });
    expect(await renderPage()).toContain("₫2,000,000, charged as ₱4,620.00");
  });

  it("marks a guest, a person who left and a deleted account", async () => {
    const guest = person("Gus", { isGuest: true });
    const gone = person("Former member", { hasLeft: true });
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...lunch,
      paidBy: guest.spotId,
      payer: guest,
      shares: [share(ana, 126733), share(guest, 126733), share(gone, 126734)],
    });
    const html = await renderPage();
    expect(html).toContain(">Guest<");
    expect(html).toContain("Former member owes");
    expect(html).toContain("(left the trip)");
  });

  it("shows who added it, and who last edited it only after an edit", async () => {
    let html = await renderPage();
    expect(html).toContain("Added by Ben · Fri, Nov 27, 20:40");
    expect(html).not.toContain("Last edited by");
    mocks.getCostBreakdownForMember.mockResolvedValue({
      ...lunch,
      addedBy: { name: "Ana", isYou: true },
      editedBy: { name: "Cara", isYou: false },
      updatedAt: new Date("2026-11-28T01:02:00Z"),
    });
    html = await renderPage();
    expect(html).toContain("Added by you · Fri, Nov 27, 20:40");
    expect(html).toContain("Last edited by Cara · Sat, Nov 28, 09:02");
  });

  it("links to Edit, Delete and Balances", async () => {
    const html = await renderPage();
    expect(html).toContain('href="/trips/trip-1/costs/c1/edit"');
    expect(html).toContain('href="/trips/trip-1/costs/c1/delete"');
    expect(html).toContain('href="/trips/trip-1/costs/balances"');
    expect(html).toContain('href="/trips/trip-1/costs"');
  });
});

describe("the Cost page receipt photo", () => {
  it("offers Add photo in the hero when there is no photo, and links to no photo address", async () => {
    const html = await renderPage();
    expect(html).toContain("Add photo");
    expect(html).toContain('name="photo"');
    expect(html).toContain('name="tripId" value="trip-1"');
    expect(html).toContain('name="costId" value="c1"');
    expect(html).not.toContain("/photo");
    expect(html).not.toContain("Photo added by");
  });

  it("shows the thumbnail as a link to the checked photo route, and who added it", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({ ...lunch, photo: { by: "Ben", at: new Date("2026-11-28T01:02:00Z") } });
    const html = await renderPage();
    expect(html).toContain('href="/trips/trip-1/costs/c1/photo"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('src="/trips/trip-1/costs/c1/photo"');
    expect(html).toContain('alt="Receipt photo"');
    expect(html).not.toContain("Add photo");
    expect(html).not.toContain('name="photo"');
    expect(html).toContain("Photo added by Ben · Sat, Nov 28, 09:02");
    expect(html).not.toContain("cost-photos/");
  });

  it("names a deleted account as Former member when they added the photo", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({ ...lunch, photo: { by: "Former member", at: new Date("2026-11-28T01:02:00Z") } });
    const html = await renderPage();
    expect(html).toContain("Photo added by Former member · Sat, Nov 28, 09:02");
    expect(html).toContain('alt="Receipt photo"');
  });

  it("says you added it when you did, and keeps it apart from Last edited", async () => {
    mocks.getCostBreakdownForMember.mockResolvedValue({ ...lunch, photo: { by: "you", at: new Date("2026-11-28T01:02:00Z") } });
    const html = await renderPage();
    expect(html).toContain("Photo added by you");
    expect(html).not.toContain("Last edited by");
  });
});
