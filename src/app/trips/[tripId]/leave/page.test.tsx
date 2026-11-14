import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaveTripPage from "./page";

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
vi.mock("@/app/trips/actions", () => ({ leaveTripAction: vi.fn() }));
vi.mock("@/components/confirm-form", () => ({
  ConfirmForm: ({ fields, label, tone }: { fields: Record<string, string>; label: string; tone: string }) => (
    <form data-fields={fields.tripId} data-tone={tone}>
      {label}
    </form>
  ),
}));

const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof LeaveTripPage>[0];

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = LeaveTripPage(props) as ReactElement<{ children: ReactElement<{ params: Promise<unknown> }> }>;
  const content = page.props.children;
  const render = content.type as (p: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u2", name: "Ben", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Saigon barkada", ownerId: "owner" });
});

describe("Leave trip page", () => {
  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("shows not found to a stranger and to the owner", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Saigon barkada", ownerId: "u2" });
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u2");
  });

  it("asks first, with Stay in trip as the amber button and a red Leave trip submit", async () => {
    const out = renderToStaticMarkup(await renderContent());
    expect(out).toContain("Leave trip");
    expect(out).toContain("Leave Saigon barkada?");
    expect(out).toContain("You won&#x27;t see this trip anymore.");
    expect(out).toContain("stay, marked &quot;left the trip&quot;.");
    expect(out).toContain("To come back, you&#x27;ll need the invite link.");
    expect(out).toContain('href="/trips/trip-1/edit"'); // back link and Stay in trip
    const stay = out.match(/<a[^>]*href="\/trips\/trip-1\/edit"[^>]*>Stay in trip<\/a>/)?.[0];
    expect(stay).toContain("bg-amber");
    expect(out).toContain('data-fields="trip-1"');
    expect(out).toContain('data-tone="danger"');
  });

  it("wraps a long trip name in the question instead of widening the page", async () => {
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "W".repeat(60), ownerId: "owner" });
    const out = renderToStaticMarkup(await renderContent());
    expect(out).toMatch(/<h2 [^>]*class="[^"]*\bwrap-anywhere\b[^"]*">Leave W{60}\?<\/h2>/);
  });
});
