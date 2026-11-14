import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditTripPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listTripMembers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  listTripMembers: mocks.listTripMembers,
}));
vi.mock("@/components/trip-form", () => ({ TripForm: () => null }));

// The page is a tree of React elements, which can point back at themselves (a link
// holds its owner), so print it with the repeats left out.
function show(node: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(node, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof EditTripPage>[0];

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = EditTripPage(props) as ReactElement<{ children: ReactElement<{ params: Promise<{ tripId: string }> }> }>;
  const content = page.props.children;
  const render = content.type as (props: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.listTripMembers.mockResolvedValue([]);
});

// The layout's check does not protect this page, so the page must check for itself.
describe("EditTripPage", () => {
  it("shows not found to someone who is not a member", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("sends a signed-out visitor away before looking up the trip", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("gives a member the form with the trip's current details", async () => {
    mocks.getTripForMember.mockResolvedValue({
      id: "trip-1",
      name: "Hội An long weekend",
      startDate: "2027-03-12",
      endDate: "2027-03-15",
      timeZone: "Asia/Ho_Chi_Minh",
      currency: "VND",
      ownerId: "u1",
      ownerName: "Maya",
      ownerImage: null,
    });
    const page = await renderContent();
    expect(show(page)).toContain("Hội An long weekend");
  });
});

describe("EditTripPage delete link", () => {
  const trip = (ownerId: string) => ({
    id: "trip-1",
    name: "Hội An long weekend",
    startDate: "2027-03-12",
    endDate: "2027-03-15",
    timeZone: "Asia/Ho_Chi_Minh",
    currency: "VND",
    destination: null,
    ownerId,
    ownerName: "Someone",
    ownerImage: null,
  });

  it("shows the Delete trip link to the owner", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("u1"));
    const page = show(await renderContent());
    expect(page).toContain("/trips/trip-1/delete");
    expect(page).toContain('/trips/trip-1/schedule'); // back link goes straight to the trip's first tab
    expect(page).toContain("Delete trip");
  });

  it("shows no Delete trip link to a member who is not the owner", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("someone-else"));
    const page = show(await renderContent());
    expect(page).not.toContain("/delete");
    expect(page).not.toContain("Delete trip");
  });
});

describe("EditTripPage leaving (SQ-006)", () => {
  const trip = (ownerId: string) => ({
    id: "trip-1",
    name: "Hội An long weekend",
    startDate: "2027-03-12",
    endDate: "2027-03-15",
    timeZone: "Asia/Ho_Chi_Minh",
    currency: "VND",
    destination: null,
    ownerId,
    ownerName: "Someone",
    ownerImage: null,
  });
  const person = (id: string) => ({ id, spotId: `s-${id}`, name: id, image: null, isGuest: false });
  const guest = { id: "g1", spotId: "g1", name: "Lito", image: null, isGuest: true };

  it("shows a red Leave trip link to a member who is not the owner", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("someone-else"));
    const page = show(await renderContent());
    expect(page).toContain("/trips/trip-1/leave");
    expect(page).toContain("Leave trip");
    expect(page).toContain("text-owe");
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("shows the owner no Leave trip link, and the make-someone-else-owner line when another person is in", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("u1"));
    mocks.listTripMembers.mockResolvedValue([person("u1"), person("u2")]);
    const page = show(await renderContent());
    expect(page).not.toContain("/leave");
    expect(page).toContain("To leave, make someone else the owner first. You can do that on");
    expect(page).toContain("/trips/trip-1/invite#people");
    expect(page).toContain("Delete trip");
  });

  it("leaves out that line when the owner is alone or only guests are in", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("u1"));
    mocks.listTripMembers.mockResolvedValue([person("u1"), guest]);
    expect(show(await renderContent())).not.toContain("To leave");
    mocks.listTripMembers.mockResolvedValue([person("u1")]);
    expect(show(await renderContent())).not.toContain("To leave");
  });
});
