import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetInviteLinkAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resetInviteCode: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ resetInviteCode: mocks.resetInviteCode }));

const none = {};

function formWith(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.resetInviteCode.mockResolvedValue(true);
});

describe("resetInviteLinkAction", () => {
  it("changes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(resetInviteLinkAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow("redirect:/");
    expect(mocks.resetInviteCode).not.toHaveBeenCalled();
  });

  it("goes to My trips without changing anything when the trip id is missing", async () => {
    await expect(resetInviteLinkAction(none, formWith({}))).rejects.toThrow("redirect:/trips");
    expect(mocks.resetInviteCode).not.toHaveBeenCalled();
  });

  it("acts as the signed-in person, ignores extra fields, refreshes the invite page and goes back to it", async () => {
    const form = formWith({ tripId: "trip-1", userId: "u9", ownerId: "u9" });
    await expect(resetInviteLinkAction(none, form)).rejects.toThrow("redirect:/trips/trip-1/invite");
    expect(mocks.resetInviteCode).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/invite");
  });

  it("ends in the same place when nothing changed (a member or a stranger)", async () => {
    mocks.resetInviteCode.mockResolvedValue(false);
    await expect(resetInviteLinkAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(
      "redirect:/trips/trip-1/invite",
    );
  });

  it("shows an error when it throws, and does not redirect", async () => {
    mocks.resetInviteCode.mockRejectedValue(new Error("db down"));
    await expect(resetInviteLinkAction(none, formWith({ tripId: "trip-1" }))).resolves.toEqual({
      error: "Couldn't make a new link. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
