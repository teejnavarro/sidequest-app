import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetLinkPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("../actions", () => ({ resetInviteLinkAction: vi.fn() }));
vi.mock("@/components/confirm-form", () => ({
  ConfirmForm: ({ fields, label, tone }: { fields: Record<string, string>; label: string; tone: string }) => (
    <form data-fields={fields.tripId} data-tone={tone}>
      {label}
    </form>
  ),
}));

const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof ResetLinkPage>[0];

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = ResetLinkPage(props) as ReactElement<{ children: ReactElement<{ params: Promise<unknown> }> }>;
  const content = page.props.children;
  const render = content.type as (p: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "owner", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Saigon barkada", ownerId: "owner" });
});

describe("New invite link page", () => {
  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("shows not found to a stranger and to a member who is not the owner", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Saigon barkada", ownerId: "someone-else" });
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "owner");
  });

  it("asks first, with Keep this link as the amber button and a quiet Get a new link", async () => {
    const out = renderToStaticMarkup(await renderContent());
    expect(out).toContain("New invite link");
    expect(out).toContain("Get a new invite link?");
    expect(out).toContain("The old link stops working right away.");
    expect(out).toContain("Anyone who hasn&#x27;t joined yet will need the new one.");
    expect(out).toContain('href="/trips/trip-1/invite"');
    const keep = out.match(/<a[^>]*href="\/trips\/trip-1\/invite"[^>]*>Keep this link<\/a>/)?.[0];
    expect(keep).toContain("bg-amber");
    expect(out).toContain('data-fields="trip-1"');
    expect(out).toContain('data-tone="quiet"');
    expect(out).toContain(">Get a new link</form>");
  });
});
