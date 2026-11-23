import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrashPage from "./trash/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listTrashForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({ listTrashForMember: mocks.listTrashForMember }));
vi.mock("./trash/restore-form", () => ({
  RestoreCostForm: (props: Record<string, unknown>) => <pre data-restore>{JSON.stringify(props)}</pre>,
}));

type Props = { params: Promise<{ tripId: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function run() {
  const element = (TrashPage as unknown as (props: Props) => ReactElement<{ children: ReactElement<Props> }>)({
    params: Promise.resolve({ tripId: "trip-1" }),
  });
  const content = element.props.children;
  const render = content.type as (props: Props) => Promise<ReactElement>;
  return renderToStaticMarkup(await render(content.props));
}

const trip = { id: "trip-1", name: "Saigon barkada", timeZone: "Asia/Manila" };

const item = (id: string, extra = {}) => ({
  id,
  description: "Grab to the market",
  amount: 57471,
  currency: "PHP",
  original: { amount: 250000, currency: "VND" },
  category: "transport",
  deletedAt: new Date("2026-11-23T06:05:00Z"),
  deletedBy: "Bea",
  deletedByYou: false,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.listTrashForMember.mockResolvedValue([]);
});

describe("Trash page", () => {
  it("shows not found to a stranger, and reads nothing from the trash", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.listTrashForMember).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("goes back to Costs and says what the trash is", async () => {
    mocks.listTrashForMember.mockResolvedValue([item("c1")]);
    const html = await run();
    expect(html).toMatch(/<a [^>]*href="\/trips\/trip-1\/costs"[^>]*>[^]*Costs<\/span>/);
    expect(html).toMatch(/<h1[^>]*>Trash<\/h1>/);
    expect(html).toContain("Deleted costs don&#x27;t count in balances. Anyone in the trip can put one back.");
  });

  it("lists who deleted each cost and when, on the trip's clock, with the original amount and Restore", async () => {
    mocks.listTrashForMember.mockResolvedValue([
      item("c1"),
      item("c2", { description: "Coffee", amount: 18000, original: null, deletedBy: "Maya", deletedByYou: true }),
    ]);
    const html = await run();
    expect(html).toContain("Deleted by Bea · Mon, Nov 23, 14:05");
    expect(html).toContain("Deleted by you · Mon, Nov 23, 14:05");
    expect(html).toContain("₱574.71");
    expect(html).toContain("₫250,000");
    expect(html.match(/₫/g)).toHaveLength(1);
    expect(html.match(/data-restore/g)).toHaveLength(2);
    expect(html).toContain("&quot;tripId&quot;:&quot;trip-1&quot;");
    expect(html).toContain("&quot;costId&quot;:&quot;c2&quot;");
  });

  it("keeps the order it was given (newest deletion first)", async () => {
    mocks.listTrashForMember.mockResolvedValue([item("c1", { description: "Newer" }), item("c2", { description: "Older" })]);
    const html = await run();
    expect(html.indexOf("Newer")).toBeLessThan(html.indexOf("Older"));
  });

  it("has an empty state", async () => {
    const html = await run();
    expect(html).toContain("Nothing in the trash.");
    expect(html).toContain("Deleted costs land here, so a wrong tap is never final.");
    expect(html).not.toContain("data-restore");
  });
});
