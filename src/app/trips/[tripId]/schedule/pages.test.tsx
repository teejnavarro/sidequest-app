import { existsSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddToSchedulePage from "./add/page";
import MoveItemPage from "./[itemId]/edit/page";
import DeleteItemPage from "./[itemId]/delete/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getScheduleItemForMember: vi.fn(),
  listApprovedUnscheduled: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/schedule", () => ({
  getScheduleItemForMember: mocks.getScheduleItemForMember,
  listApprovedUnscheduled: mocks.listApprovedUnscheduled,
}));
// Show the forms' props as text, so the pages' choices (which values, which place) can be read.
vi.mock("@/components/schedule-form", () => ({
  ScheduleForm: (props: Record<string, unknown>) => <pre data-form>{JSON.stringify(props)}</pre>,
}));
vi.mock("@/components/remove-item-form", () => ({
  RemoveItemForm: (props: Record<string, unknown>) => <pre data-remove>{JSON.stringify(props)}</pre>,
}));

type Props = {
  params: Promise<{ tripId: string; itemId?: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

// Each page keeps its work in a component inside Suspense, so run that component directly.
async function run(
  page: (props: never) => unknown,
  options: { itemId?: string; search?: Record<string, string | string[] | undefined> } = {},
) {
  const element = (page as (props: Props) => ReactElement<{ children: ReactElement<Props> }>)({
    params: Promise.resolve({ tripId: "trip-1", itemId: options.itemId }),
    searchParams: Promise.resolve(options.search ?? {}),
  });
  const content = element.props.children;
  const render = content.type as (props: Props) => Promise<ReactElement>;
  // The mocked forms print their props as JSON, which the markup escapes; read it back plainly.
  return renderToStaticMarkup(await render(content.props)).replaceAll("&quot;", '"');
}

const trip = {
  id: "trip-1",
  name: "Saigon barkada",
  startDate: "2027-05-08",
  endDate: "2027-05-10",
  timeZone: "Asia/Ho_Chi_Minh",
};

const ideas = [
  { id: "idea-1", name: "Phở Hòa Pasteur", type: "food" },
  { id: "idea-2", name: "War Remnants Museum", type: "sightseeing" },
];

const item = (extra = {}) => ({
  id: "item-1",
  name: "Airport transfer",
  ideaType: null,
  ideaId: null,
  fromIdea: false,
  notes: "Meet at the lobby",
  day: "2027-05-10",
  slot: "time",
  time: "07:00",
  createdAt: new Date(),
  updatedBy: { id: "u2", firstName: "Ben" },
  ...extra,
});
const ideaItem = (extra = {}) =>
  item({ name: "Chợ Bến Thành", ideaType: "sightseeing", ideaId: "idea-9", fromIdea: true, notes: null, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.getScheduleItemForMember.mockResolvedValue(item());
  mocks.listApprovedUnscheduled.mockResolvedValue(ideas);
});

describe.each([
  ["Add to schedule", AddToSchedulePage, {}],
  ["Move item", MoveItemPage, { itemId: "item-1" }],
  ["Delete item", DeleteItemPage, { itemId: "item-1" }],
] as const)("%s page", (_name, page, options) => {
  it("checks membership itself: not found for someone who is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    mocks.getScheduleItemForMember.mockResolvedValue(null);
    await expect(run(page, options)).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run(page, options)).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("has a band back to the Schedule tab and no tab bar", async () => {
    const html = await run(page, options);
    expect(html).toContain('href="/trips/trip-1/schedule"');
    expect(html).toContain(">Schedule<");
    expect(html).not.toContain("Trip sections");
  });
});

describe("Add to schedule page", () => {
  it("shows not found when the privacy layer says the trip is not yours, and reads no ideas", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run(AddToSchedulePage)).rejects.toThrow("not-found");
    expect(mocks.listApprovedUnscheduled).not.toHaveBeenCalled();
  });

  it("starts on Approved idea with the approved, unscheduled ideas and the trip's days and place", async () => {
    const html = await run(AddToSchedulePage);
    expect(html).toContain(">Add to schedule</h1>");
    expect(html).toContain('aria-label="What are you adding?"');
    expect(html).toContain('href="/trips/trip-1/schedule/add?from=idea"');
    expect(html).toContain('href="/trips/trip-1/schedule/add?from=new"');
    expect(html).toMatch(/aria-current="page"[^>]*>Approved idea</);
    expect(html).toContain('"mode":"add"');
    expect(html).toContain('"kind":"idea"');
    expect(html).toContain('"place":"Vietnam"');
    expect(html).toContain('"day":"2027-05-08"');
    expect(html).toContain('"day":"2027-05-10"');
    expect(html).toContain("Phở Hòa Pasteur");
    expect(html).toContain('"ideaId":""');
  });

  it("preselects the idea in ?idea= and the idea option", async () => {
    const html = await run(AddToSchedulePage, { search: { idea: "idea-2", from: "new" } });
    expect(html).toContain('"kind":"idea"');
    expect(html).toContain('"ideaId":"idea-2"');
  });

  it("ignores an ?idea= that is not an approved, unscheduled idea of this trip", async () => {
    const html = await run(AddToSchedulePage, { search: { idea: "someone-elses-idea" } });
    expect(html).toContain('"ideaId":""');
  });

  it("switches to Something new with ?from=new", async () => {
    const html = await run(AddToSchedulePage, { search: { from: "new" } });
    expect(html).toContain('"kind":"new"');
    expect(html).toMatch(/aria-current="page"[^>]*>Something new</);
  });

  it("passes no ideas when none are approved, so the form can say so", async () => {
    mocks.listApprovedUnscheduled.mockResolvedValue([]);
    const html = await run(AddToSchedulePage);
    expect(html).toContain('"ideas":[]');
  });
});

describe("Move item page", () => {
  it("shows not found for an item that is not in this trip", async () => {
    mocks.getScheduleItemForMember.mockResolvedValue(null);
    await expect(run(MoveItemPage, { itemId: "item-1" })).rejects.toThrow("not-found");
    expect(mocks.getScheduleItemForMember).toHaveBeenCalledWith("trip-1", "item-1", "u1");
  });

  it("fills the form from a new item and offers Delete item", async () => {
    const html = await run(MoveItemPage, { itemId: "item-1" });
    expect(html).toContain(">Move item</h1>");
    expect(html).toContain('"mode":"move"');
    expect(html).toContain('"kind":"new"');
    expect(html).toContain('"name":"Airport transfer"');
    expect(html).toContain('"notes":"Meet at the lobby"');
    expect(html).toContain('"day":"2027-05-10","slot":"time","time":"07:00"');
    expect(html).toContain('href="/trips/trip-1/schedule/item-1/delete"');
    expect(html).toContain(">Delete item<");
    expect(html).not.toContain("Back to approved ideas");
    expect(html).not.toContain("data-remove");
  });

  it("shows an idea item's name as a heading, with Back to approved ideas and no Delete", async () => {
    mocks.getScheduleItemForMember.mockResolvedValue(ideaItem());
    const html = await run(MoveItemPage, { itemId: "item-1" });
    expect(html).toContain("<h2");
    expect(html).toContain("Chợ Bến Thành");
    expect(html).toContain("From ideas");
    expect(html).toContain('"kind":"idea"');
    expect(html).toContain('"name":""'); // the idea owns the name
    expect(html).toContain("Back to approved ideas");
    expect(html).not.toContain("/delete");
  });
});

describe("Delete item page", () => {
  it("asks 'Delete <name>?' with Keep item as the main button", async () => {
    const html = await run(DeleteItemPage, { itemId: "item-1" });
    expect(html).toContain(">Delete item</h1>");
    expect(html).toContain("Delete Airport transfer?");
    expect(html).toContain("This deletes it for good. You can&#x27;t undo this.");
    expect(html).toMatch(/href="\/trips\/trip-1\/schedule\/item-1\/edit"[^>]*>Keep item</);
    expect(html).toContain('"danger":true');
  });

  it("is only for new items: an idea item is not found", async () => {
    mocks.getScheduleItemForMember.mockResolvedValue(ideaItem());
    await expect(run(DeleteItemPage, { itemId: "item-1" })).rejects.toThrow("not-found");
  });
});

describe("the new addresses", () => {
  it("live outside the tab group, so only the Schedule tab shows the tab bar", () => {
    const base = "src/app/trips/[tripId]/schedule";
    for (const path of ["add/page.tsx", "[itemId]/edit/page.tsx", "[itemId]/delete/page.tsx"]) {
      expect(existsSync(`${base}/${path}`)).toBe(true);
    }
    expect(existsSync("src/app/trips/[tripId]/(tabs)/schedule/page.tsx")).toBe(true);
  });
});
