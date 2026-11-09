import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchedulePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listScheduleForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/schedule", () => ({ listScheduleForMember: mocks.listScheduleForMember }));
// The scroller draws nothing, so mark where it is used.
vi.mock("@/components/scroll-to-today", () => ({
  ScrollToToday: ({ day }: { day: string }) => <i data-scroll-to={day} />,
}));

type ContentProps = { params: Promise<{ tripId: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function render() {
  const page = SchedulePage({
    params: Promise.resolve({ tripId: "trip-1" }),
  } as Parameters<typeof SchedulePage>[0]) as ReactElement<{ children: ReactElement<ContentProps> }>;
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(content.props));
}

const trip = {
  id: "trip-1",
  startDate: "2027-05-08",
  endDate: "2027-05-11",
  timeZone: "Asia/Ho_Chi_Minh",
};

let seq = 0;
const item = (name: string, day: string, slot: string, time: string | null = null, extra = {}) => ({
  id: `item-${++seq}`,
  name,
  ideaType: null,
  ideaId: null,
  fromIdea: false,
  notes: null,
  day,
  slot,
  time,
  createdAt: new Date("2027-01-01T00:00:00Z"),
  updatedBy: { id: "u2", firstName: "Ben" },
  ...extra,
});

const cardOf = (html: string, label: string) =>
  html.match(new RegExp(`<section id="[^"]*" aria-label="${label}"[^]*?</section>`))?.[0] ??
  html.match(new RegExp(`<section aria-label="${label}"[^]*?</section>`))?.[0] ??
  "";

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  // Long before the trip, so no day is "today" unless a test says so.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.listScheduleForMember.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the Schedule tab", () => {
  it("shows not found to someone who is not in the trip, and reads no schedule", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.listScheduleForMember).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("shows one card per trip day, each with its day number and an anchor", async () => {
    const html = await render();
    for (const [day, label, n] of [
      ["2027-05-08", "Sat, May 8", 1],
      ["2027-05-09", "Sun, May 9", 2],
      ["2027-05-10", "Mon, May 10", 3],
      ["2027-05-11", "Tue, May 11", 4],
    ] as const) {
      expect(html).toContain(`id="day-${day}"`);
      expect(html).toContain(`>${label}<`);
      expect(html).toContain(`Day ${n}`);
    }
    expect(html.match(/<section /g)).toHaveLength(4);
    expect(html.match(/Nothing planned yet\./g)).toHaveLength(4);
    expect(html.match(/Add to schedule/g)).toHaveLength(1);
    expect(html).toContain('href="/trips/trip-1/schedule/add"');
  });

  it("puts each item on its day, in the order the privacy layer gives", async () => {
    mocks.listScheduleForMember.mockResolvedValue([
      item("Hotel check-in", "2027-05-08", "afternoon"),
      item("Night market", "2027-05-08", "time", "19:30", { fromIdea: true, ideaType: "food" }),
      item("Airport transfer", "2027-05-11", "time", "07:00", { notes: "Meet at the lobby" }),
    ]);
    const html = await render();
    const first = cardOf(html, "Sat, May 8");
    expect(first.indexOf("Hotel check-in")).toBeLessThan(first.indexOf("Night market"));
    expect(first).not.toContain("Nothing planned yet.");
    expect(cardOf(html, "Sun, May 9")).toContain("Nothing planned yet.");
    expect(cardOf(html, "Tue, May 11")).toContain("Airport transfer");
    expect(html.match(/Nothing planned yet\./g)).toHaveLength(2);
  });

  it("shows when, name, where it came from or its notes, and who last changed it", async () => {
    mocks.listScheduleForMember.mockResolvedValue([
      item("Night market", "2027-05-08", "time", "19:30", { fromIdea: true, ideaId: "i1" }),
      item("Airport transfer", "2027-05-11", "time", "07:00", { notes: "Meet at the lobby" }),
      item("Cu Chi tour", "2027-05-09", "full", null, { fromIdea: true, ideaId: "i2" }),
    ]);
    const html = await render();
    expect(html).toContain(">19:30<");
    expect(html).toContain(">07:00<");
    expect(html).toContain(">Full day<");
    expect(html).toMatch(/From ideas ·/);
    expect(html).toContain("Meet at the lobby");
    expect(html.match(/Last changed by Ben/g)).toHaveLength(3);
    expect(html).not.toContain("@");
  });

  it("makes each whole row a link to its Move page", async () => {
    mocks.listScheduleForMember.mockResolvedValue([item("Night market", "2027-05-08", "morning")]);
    const html = await render();
    expect(html).toContain('href="/trips/trip-1/schedule/item-1/edit"');
    expect(html).toMatch(/<a [^>]*href="\/trips\/trip-1\/schedule\/item-1\/edit"[^>]*>[^]*Night market[^]*<\/a>/);
  });

  it("marks today with a blue edge, a Today tag and the scroller, using the trip's own zone", async () => {
    // 20:00 UTC on May 9 is already May 10 in Ho Chi Minh City.
    vi.setSystemTime(new Date("2027-05-09T20:00:00Z"));
    const html = await render();
    const today = cardOf(html, "Mon, May 10");
    expect(today).toContain("border-2 border-blue-text");
    expect(today).toContain(">Today<");
    expect(today).not.toContain("Day 3");
    expect(html.match(/>Today</g)).toHaveLength(1);
    expect(html.match(/border-2 border-blue-text/g)).toHaveLength(1);
    expect(html).toContain('data-scroll-to="2027-05-10"');
  });

  it("has no Today card and no scroller when today is not a trip day", async () => {
    const html = await render();
    expect(html).not.toContain(">Today<");
    expect(html).not.toContain("border-blue-text");
    expect(html).not.toContain("data-scroll-to");
  });

  it("collects items outside the trip's days in a final 'Needs a new day' card", async () => {
    mocks.listScheduleForMember.mockResolvedValue([
      item("Too late", "2027-05-12", "morning"),
      item("Too early", "2027-05-07", "full"),
      item("Fine", "2027-05-09", "morning"),
    ]);
    const html = await render();
    const needs = cardOf(html, "Needs a new day");
    expect(needs).toContain("Too late");
    expect(needs).toContain("Too early");
    expect(needs).not.toContain("Fine");
    expect(html.lastIndexOf("Needs a new day")).toBeGreaterThan(html.indexOf("Tue, May 11"));
    expect(cardOf(html, "Sun, May 9")).toContain("Fine");
    expect(html.match(/<section /g)).toHaveLength(5);
  });

  it("leaves out the 'Needs a new day' card when every item is on a trip day", async () => {
    mocks.listScheduleForMember.mockResolvedValue([item("Fine", "2027-05-09", "morning")]);
    expect(await render()).not.toContain("Needs a new day");
  });
});
