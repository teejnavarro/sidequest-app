import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getInviteCodeForMember: vi.fn(),
  getTripForMember: vi.fn(),
  listTripMembers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getInviteCodeForMember: mocks.getInviteCodeForMember,
  getTripForMember: mocks.getTripForMember,
  listTripMembers: mocks.listTripMembers,
}));
vi.mock("@/components/invite-actions", () => ({ InviteActions: () => null }));
vi.mock("@/components/face", () => ({ Face: () => null }));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";
const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof InvitePage>[0];

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = InvitePage(props) as ReactElement<{ children: ReactElement<{ params: Promise<{ tripId: string }> }> }>;
  const content = page.props.children;
  const render = content.type as (props: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

// The layout's check does not protect this page, so the page must check for itself.
describe("InvitePage", () => {
  it("shows not found to someone who is not a member, and reads nothing else", async () => {
    mocks.getInviteCodeForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getInviteCodeForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getInviteCodeForMember).not.toHaveBeenCalled();
  });

  const member = (id: string, name: string) => ({ id, name, image: null });

  async function renderFor(members: ReturnType<typeof member>[]) {
    mocks.getInviteCodeForMember.mockResolvedValue(CODE);
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Hội An", ownerId: "u1" });
    mocks.listTripMembers.mockResolvedValue(members);
    return renderToStaticMarkup(await renderContent());
  }

  it("gives a member the short band, the whole link and who is in", async () => {
    const html = await renderFor([member("u1", "Maya"), member("u2", "Ben")]);
    expect(html).toContain("Invite people");
    expect(html).toContain('href="/trips/trip-1"'); // back link goes to the trip
    expect(html).toContain("Hội An"); // and names it
    expect(html).toContain(`http://localhost:3000/join/${CODE}`); // the whole link stays in the page
    expect(html).toMatch(/<p class="truncate[^"]*select-all">http/); // shown on one shortened line
    expect(html).toContain("2 people are in");
    expect(html).toContain("Maya");
    expect(html).toContain("Ben");
  });

  it("marks only the owner with a quiet Owner tag, with no brackets", async () => {
    const html = await renderFor([member("u1", "Maya"), member("u2", "Ben")]);
    expect(html.match(/>Owner</g)).toHaveLength(1);
    expect(html).not.toMatch(/\(\s*owner\s*\)/i);
  });

  it("says 1 person is in when it is just the owner", async () => {
    expect(await renderFor([member("u1", "Maya")])).toContain("1 person is in");
  });
});
