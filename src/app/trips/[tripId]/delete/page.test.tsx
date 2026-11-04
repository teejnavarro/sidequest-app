import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteTripPage from "./page";

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
vi.mock("./delete-form", () => ({ DeleteForm: () => <button>Delete trip</button> }));

const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof DeleteTripPage>[0];

const trip = (ownerId: string) => ({
  id: "trip-1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  destination: null,
  ownerId,
  ownerName: "Maya",
  ownerImage: null,
});

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, name: `Person ${i + 1}`, image: null }));

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = DeleteTripPage(props) as ReactElement<{ children: ReactElement<{ params: Promise<{ tripId: string }> }> }>;
  const content = page.props.children;
  const render = content.type as (props: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
});

// The layout's check does not protect this page, so the page must check for itself.
describe("DeleteTripPage", () => {
  it("shows not found to a member who is not the owner, and reads no more", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("someone-else"));
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("shows not found to a stranger or for a missing trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("says how many people it affects when there are others", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("u1"));
    mocks.listTripMembers.mockResolvedValue(people(4));
    const html = renderToStaticMarkup(await renderContent());
    expect(html).toContain("Delete Hội An long weekend?");
    expect(html).toContain("This deletes it for all 4 people in the trip. You can&#x27;t undo this.");
    expect(html).toContain("Keep trip");
    expect(html).toContain('href="/trips/trip-1/edit"');
    expect(html).toContain("Delete trip");
  });

  it("uses the one-person wording when the owner is alone", async () => {
    mocks.getTripForMember.mockResolvedValue(trip("u1"));
    mocks.listTripMembers.mockResolvedValue(people(1));
    const html = renderToStaticMarkup(await renderContent());
    expect(html).toContain("This deletes it for good. You can&#x27;t undo this.");
    expect(html).not.toContain("people");
  });
});
