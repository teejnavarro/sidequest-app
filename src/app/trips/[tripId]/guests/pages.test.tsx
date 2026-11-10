import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EditGuestPage from "./[spotId]/edit/page";
import RemoveGuestPage from "./[spotId]/remove/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getGuestForEditor: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  getGuestForEditor: mocks.getGuestForEditor,
}));
vi.mock("./[spotId]/edit/edit-guest-form", () => ({
  EditGuestForm: ({ tripId, spotId, name }: { tripId: string; spotId: string; name: string }) => (
    <form data-edit={`${tripId}/${spotId}/${name}`}>Save changes</form>
  ),
}));
vi.mock("./[spotId]/remove/remove-guest-form", () => ({
  RemoveGuestForm: ({ tripId, spotId }: { tripId: string; spotId: string }) => (
    <form data-remove={`${tripId}/${spotId}`}>Remove guest</form>
  ),
}));

const props = {
  params: Promise.resolve({ tripId: "trip-1", spotId: "spot-1" }),
} as Parameters<typeof EditGuestPage>[0];

// Each page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent(page: (p: typeof props) => ReactElement) {
  const suspense = page(props) as ReactElement<{ children: ReactElement<{ params: Promise<unknown> }> }>;
  const content = suspense.props.children;
  const render = content.type as (p: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

const TRIP = { id: "trip-1", name: "Saigon barkada", ownerId: "owner" };
const GUEST = { spotId: "spot-1", name: "Lito", addedById: "u2", addedByName: "Ben Santos" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u2", name: "Ben", image: null });
  mocks.getTripForMember.mockResolvedValue(TRIP);
  mocks.getGuestForEditor.mockResolvedValue(GUEST);
});

describe.each([
  ["Edit guest", EditGuestPage],
  ["Remove guest", RemoveGuestPage],
] as const)("%s page", (_name, Page) => {
  const render = () => renderContent(Page as (p: typeof props) => ReactElement);

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
    expect(mocks.getGuestForEditor).not.toHaveBeenCalled();
  });

  it("asks the privacy layer with the signed-in person, not anything from the page", async () => {
    await render();
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u2");
    expect(mocks.getGuestForEditor).toHaveBeenCalledWith("trip-1", "spot-1", "u2");
  });

  it.each([
    ["a stranger, a member who can't change the guest, a claimed or an unknown spot", null],
  ])("shows not found for %s", async (_label, guest) => {
    mocks.getGuestForEditor.mockResolvedValue(guest);
    await expect(render()).rejects.toThrow("not-found");
  });

  it("shows not found to a person who is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
  });
});

describe("Edit guest", () => {
  const html = async () => renderToStaticMarkup(await renderContent(EditGuestPage as never));

  it("has the band, the form with the guest's name and a red Remove guest link", async () => {
    const out = await html();
    expect(out).toContain("Edit guest");
    expect(out).toContain('href="/trips/trip-1/invite#people"');
    expect(out).toContain("Invite people");
    expect(out).toContain('data-edit="trip-1/spot-1/Lito"');
    const link = out.match(/<a[^>]*href="\/trips\/trip-1\/guests\/spot-1\/remove"[^>]*>Remove guest<\/a>/)?.[0];
    expect(link).toContain("text-owe");
    expect(out).toContain("A guest who&#x27;s part of any costs can&#x27;t be removed.");
  });

  it("names the adder's first name and the trip owner for another editor", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "owner", name: "Maya", image: null });
    expect(await html()).toContain("Added by Ben. Only Ben or the trip owner can change this guest.");
  });

  it("says Only you when the viewer is the adder", async () => {
    expect(await html()).toContain("Added by Ben. Only you or the trip owner can change this guest.");
  });
});

describe("Remove guest", () => {
  const html = async () => renderToStaticMarkup(await renderContent(RemoveGuestPage as never));

  it("asks Remove <name>? and makes Keep guest the main button", async () => {
    const out = await html();
    expect(out).toContain("Remove Lito?");
    expect(out).toContain("They&#x27;ll be taken off this trip.");
    const keep = out.match(/<a[^>]*href="\/trips\/trip-1\/guests\/spot-1\/edit"[^>]*>Keep guest<\/a>/)?.[0];
    expect(keep).toContain("bg-amber");
    expect(out).toContain('data-remove="trip-1/spot-1"');
  });
});
