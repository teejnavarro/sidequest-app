import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemberPage from "./[spotId]/page";
import MakeOwnerPage from "./[spotId]/owner/page";
import RemoveMemberPage from "./[spotId]/remove/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getMemberForOwner: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  getMemberForOwner: mocks.getMemberForOwner,
}));
vi.mock("./actions", () => ({ transferOwnershipAction: vi.fn(), removeMemberAction: vi.fn() }));
vi.mock("@/components/face", () => ({ Face: () => null }));
vi.mock("@/components/confirm-form", () => ({
  ConfirmForm: ({
    fields,
    label,
    tone,
  }: {
    fields: Record<string, string>;
    label: string;
    tone: string;
  }) => (
    <form data-fields={`${fields.tripId}/${fields.spotId}`} data-tone={tone}>
      {label}
    </form>
  ),
}));

const props = {
  params: Promise.resolve({ tripId: "trip-1", spotId: "spot-1" }),
} as Parameters<typeof MemberPage>[0];

// Each page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent(page: (p: typeof props) => ReactElement) {
  const suspense = page(props) as ReactElement<{ children: ReactElement<{ params: Promise<unknown> }> }>;
  const content = suspense.props.children;
  const render = content.type as (p: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

const TRIP = { id: "trip-1", name: "Saigon barkada", ownerId: "owner" };
const MEMBER = { spotId: "spot-1", userId: "u2", name: "Bea Santos", image: null, costCount: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "owner", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue(TRIP);
  mocks.getMemberForOwner.mockResolvedValue(MEMBER);
});

describe.each([
  ["Member", MemberPage],
  ["Make owner", MakeOwnerPage],
  ["Remove member", RemoveMemberPage],
] as const)("%s page", (_name, Page) => {
  const render = () => renderContent(Page as (p: typeof props) => ReactElement);

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
    expect(mocks.getMemberForOwner).not.toHaveBeenCalled();
  });

  it("asks the privacy layer with the signed-in person, not anything from the page", async () => {
    await render();
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "owner");
    expect(mocks.getMemberForOwner).toHaveBeenCalledWith("trip-1", "spot-1", "owner");
  });

  it("shows not found for a non-owner, a guest, the owner's own row or a person who left", async () => {
    mocks.getMemberForOwner.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
  });

  it("shows not found to a person who is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
  });
});

describe("Member", () => {
  const html = async () => renderToStaticMarkup(await renderContent(MemberPage as never));

  it("has the band back to Invite people, the name and the two actions", async () => {
    const out = await html();
    expect(out).toContain('href="/trips/trip-1/invite#people"');
    expect(out).toContain("Invite people");
    expect(out).toContain("Bea Santos");
    const owner = out.match(/<a[^>]*href="\/trips\/trip-1\/members\/spot-1\/owner"[^>]*>.*?<\/a>/)?.[0];
    expect(owner).toContain("Make Bea the owner");
    expect(owner).toContain("bg-chip");
    const remove = out.match(/<a[^>]*href="\/trips\/trip-1\/members\/spot-1\/remove"[^>]*>Remove from trip<\/a>/)?.[0];
    expect(remove).toContain("text-owe");
  });

  it("shows the cost count only when the person is part of a cost", async () => {
    expect(await html()).not.toContain("Part of");
    mocks.getMemberForOwner.mockResolvedValue({ ...MEMBER, costCount: 1 });
    expect(await html()).toContain("Part of 1 cost<");
    mocks.getMemberForOwner.mockResolvedValue({ ...MEMBER, costCount: 3 });
    expect(await html()).toContain("Part of 3 costs");
  });
});

describe("Make owner", () => {
  const html = async () => renderToStaticMarkup(await renderContent(MakeOwnerPage as never));

  it("explains what changes, and has an amber submit and a Go back link", async () => {
    const out = await html();
    expect(out).toContain("Make Bea the owner?");
    expect(out).toContain("Bea will manage people, the invite link and deleting the trip.");
    expect(out).toContain("You stay in the trip as a member. Only Bea can hand it back.");
    expect(out).toContain('data-fields="trip-1/spot-1"');
    expect(out).toContain('data-tone="primary"');
    expect(out).toContain(">Make Bea the owner</form>");
    expect(out).toMatch(/<a[^>]*href="\/trips\/trip-1\/members\/spot-1"[^>]*>Go back<\/a>/);
  });
});

describe("Remove member", () => {
  const html = async () => renderToStaticMarkup(await renderContent(RemoveMemberPage as never));

  it("makes Keep the amber button and Remove from trip the red submit", async () => {
    const out = await html();
    expect(out).toContain("Remove Bea from the trip?");
    expect(out).toContain("Bea won&#x27;t see this trip anymore.");
    expect(out).toContain("stay, marked &quot;left the trip&quot;.");
    expect(out).toContain("Bea could rejoin with the invite link. Get a new link afterwards");
    const keep = out.match(/<a[^>]*href="\/trips\/trip-1\/members\/spot-1"[^>]*>Keep Bea<\/a>/)?.[0];
    expect(keep).toContain("bg-amber");
    expect(out).toContain('data-tone="danger"');
    expect(out).toContain(">Remove from trip</form>");
  });
});
