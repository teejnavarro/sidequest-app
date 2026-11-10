import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  // A fixed "now": 2027-03-01 at noon in Manila, so the trip is 11 days away.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-03-01T04:00:00Z"));
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


afterEach(() => {
  vi.useRealTimers();
});

const baseTrip = {
  id: "trip-1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null as string | null,
  ownerId: "u1",
  ownerName: "Maya",
  ownerImage: null,
};

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, name: `Person ${i + 1}`, image: null }));

describe("the trip header", () => {
  it("forces the light header color on the back link, over the link's usual muted color", async () => {
    const html = await renderHeader();
    const backLink = /<a[^>]*href="\/trips"[^>]*>/.exec(html)?.[0];
    expect(backLink).toContain("text-band-muted!");
  });

  it("with no destination shows the dates with the offset and place, and no pin", async () => {
    const html = await renderHeader();
    expect(html).toContain("Mar 12–15, 2027 · GMT+8 Philippines");
    expect(html).not.toContain("lucide");
    // The pin is a Phosphor icon: no destination means no icon next to the supporting line.
    expect(html).not.toMatch(/<svg[^>]*>[^]*?<\/svg>\s*<span class="min-w-0 wrap-anywhere">Mar/);
  });

  it("with a destination shows it with the offset only, after a pin", async () => {
    mocks.getTripForMember.mockResolvedValue({ ...baseTrip, destination: "Hội An" });
    const html = await renderHeader();
    expect(html).toContain("Hội An · Mar 12–15, 2027 · GMT+8");
    expect(html).not.toContain("GMT+8 Philippines");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*>[^]*?<\/svg>\s*<span class="min-w-0 wrap-anywhere">Hội An/);
  });

  it("shows a zone it does not know as its raw name, with no offset", async () => {
    mocks.getTripForMember.mockResolvedValue({ ...baseTrip, timeZone: "Not/AZone" });
    expect(await renderHeader()).toContain("Mar 12–15, 2027 · Not/AZone");
    mocks.getTripForMember.mockResolvedValue({ ...baseTrip, timeZone: "Not/AZone", destination: "Somewhere" });
    expect(await renderHeader()).toContain("Somewhere · Mar 12–15, 2027 · Not/AZone");
  });

  it("shows the trip time tag worked out in the trip's own zone", async () => {
    expect(await renderHeader()).toContain("In 11 days");
    // 2027-03-11 17:00 UTC is already the 12th in Manila: the first day of the trip.
    vi.setSystemTime(new Date("2027-03-11T17:00:00Z"));
    expect(await renderHeader()).toContain("Day 1 of 4");
    vi.setSystemTime(new Date("2027-03-16T00:00:00Z"));
    expect(await renderHeader()).toContain("Trip&#x27;s over");
  });

  it("says how many are going, or that it is just you so far", async () => {
    mocks.listTripMembers.mockResolvedValue(people(3));
    expect(await renderHeader()).toContain("3 going");
    mocks.listTripMembers.mockResolvedValue(people(1));
    expect(await renderHeader()).toContain("Just you so far");
  });

  it("counts a guest as going, so you and one guest is not just you", async () => {
    mocks.listTripMembers.mockResolvedValue([
      { id: "u1", spotId: "s1", name: "Maya", image: null, isGuest: false, addedById: null, addedByName: null },
      { id: "s2", spotId: "s2", name: "Dana", image: null, isGuest: true, addedById: "u1", addedByName: "Maya" },
    ]);
    const html = await renderHeader();
    expect(html).toContain("2 going");
    expect(html).not.toContain("Just you so far");
    // The guest's face is the plain gray circle; Maya keeps her color.
    expect(html).toMatch(/aria-label="Dana"[^>]*class="[^"]*bg-chip text-ink[^"]*">D</);
    expect(html).toMatch(/aria-label="Maya"[^>]*class="[^"]*text-on-face[^"]*">M</);
  });

  it("has no Owner line, no Edit trip pill, one Invite people pill and a pencil", async () => {
    const html = await renderHeader();
    expect(html).not.toContain("Owner");
    expect(html).not.toMatch(/>Edit trip</);
    expect(html).toContain('aria-label="Edit trip"');
    expect(html).toContain('href="/trips/trip-1/edit"');
    expect(html.match(/Invite people/g)).toHaveLength(1);
    expect(html).toContain('href="/trips/trip-1/invite"');
  });

  it("wraps a long trip name instead of overflowing", async () => {
    mocks.getTripForMember.mockResolvedValue({ ...baseTrip, name: "A".repeat(80) });
    const html = await renderHeader();
    expect(html).toMatch(/<h1 class="[^"]*wrap-anywhere[^"]*">A{80}<\/h1>/);
  });

  it("shows not found to someone who is not a member", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderHeader()).rejects.toThrow("not-found");
  });
});
