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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

// The layout's check does not protect this page, so the page must check for itself.
describe("InvitePage", () => {
  it("shows not found to someone who is not a member, and reads nothing else", async () => {
    mocks.getInviteCodeForMember.mockResolvedValue(null);
    await expect(InvitePage(props)).rejects.toThrow("not-found");
    expect(mocks.getInviteCodeForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(InvitePage(props)).rejects.toThrow("redirect:/");
    expect(mocks.getInviteCodeForMember).not.toHaveBeenCalled();
  });

  it("gives a member the link and the list of who is in", async () => {
    mocks.getInviteCodeForMember.mockResolvedValue(CODE);
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Hội An", ownerId: "u1" });
    mocks.listTripMembers.mockResolvedValue([
      { id: "u1", name: "Maya", image: null },
      { id: "u2", name: "Ben", image: null },
    ]);
    const page = JSON.stringify(await InvitePage(props));
    expect(page).toContain(`http://localhost:3000/join/${CODE}`);
    expect(page).toContain("Who");
    expect(page).toContain("Maya");
    expect(page).toContain("Ben");
    expect(page).toContain("(owner)");
  });
});
