import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TripLayout from "./layout";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listTripMembers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  usePathname: () => "/trips/trip-1/schedule",
}));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  listTripMembers: mocks.listTripMembers,
}));

type ShellProps = { params: Promise<{ tripId: string }>; children: ReactNode };

// The header lives in a component inside Suspense, so run that component directly.
async function renderHeader() {
  const layout = TripLayout({
    params: Promise.resolve({ tripId: "trip-1" }),
    children: null,
  } as unknown as Parameters<typeof TripLayout>[0]) as ReactElement<{ children: ReactElement<ShellProps> }>;
  const shell = layout.props.children;
  const render = shell.type as (props: ShellProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await render(shell.props));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.listTripMembers.mockResolvedValue([{ id: "u1", name: "Maya", image: null }]);
  mocks.getTripForMember.mockResolvedValue({
    id: "trip-1",
    name: "Hội An long weekend",
    startDate: "2027-03-12",
    endDate: "2027-03-15",
    timeZone: "Asia/Manila",
    currency: "PHP",
    destination: null,
    ownerId: "u1",
    ownerName: "Maya",
    ownerImage: null,
  });
});

describe("the trip header", () => {
  it("forces the light header color on the back link, over the link's usual muted color", async () => {
    const html = await renderHeader();
    const backLink = /<a[^>]*href="\/trips"[^>]*>/.exec(html)?.[0];
    expect(backLink).toContain("text-band-muted!");
  });

  it("shows the dates with the GMT offset and place", async () => {
    expect(await renderHeader()).toContain("Mar 12–15, 2027 · GMT+8 Philippines");
  });

  it("shows not found to someone who is not a member", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderHeader()).rejects.toThrow("not-found");
  });
});
