import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeMemberAction, transferOwnershipAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  transferOwnership: vi.fn(),
  removeMember: vi.fn(),
  getMemberForOwner: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  transferOwnership: mocks.transferOwnership,
  removeMember: mocks.removeMember,
  getMemberForOwner: mocks.getMemberForOwner,
}));

const PEOPLE = "redirect:/trips/trip-1/invite#people";
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
  mocks.transferOwnership.mockResolvedValue(true);
  mocks.removeMember.mockResolvedValue(true);
  mocks.getMemberForOwner.mockResolvedValue({
    spotId: "spot-1",
    userId: "u2",
    name: "Bea Santos",
    image: null,
    costCount: 0,
  });
});

describe.each([
  ["transferOwnershipAction", transferOwnershipAction, mocks.transferOwnership, "make Bea the owner"],
  ["removeMemberAction", removeMemberAction, mocks.removeMember, "remove Bea"],
] as const)("%s", (_name, action, change, wording) => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", spotId: "spot-1", ...extra });

  it("changes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(action(none, form())).rejects.toThrow("redirect:/");
    expect(change).not.toHaveBeenCalled();
  });

  it("goes to My trips without changing anything when the trip id is missing", async () => {
    await expect(action(none, formWith({ spotId: "spot-1" }))).rejects.toThrow("redirect:/trips");
    expect(change).not.toHaveBeenCalled();
  });

  it("goes to the people list without changing anything when the spot id is missing", async () => {
    await expect(action(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(PEOPLE);
    expect(change).not.toHaveBeenCalled();
  });

  it("acts as the signed-in person, ignores extra fields, refreshes the pages and goes to the people list", async () => {
    await expect(action(none, form({ userId: "u9", ownerId: "u9", name: "Eve" }))).rejects.toThrow(PEOPLE);
    expect(change).toHaveBeenCalledWith("trip-1", "spot-1", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1", "layout");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/invite");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("ends in the same place when nothing changed (not the owner, or already gone)", async () => {
    change.mockResolvedValue(false);
    await expect(action(none, form())).rejects.toThrow(PEOPLE);
  });

  it("shows an error with the first name when the change throws, and does not redirect", async () => {
    change.mockRejectedValue(new Error("db down"));
    await expect(action(none, form())).resolves.toEqual({
      error: `Couldn't ${wording}. Please try again.`,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falls back to this person when the name can't be read either", async () => {
    change.mockRejectedValue(new Error("db down"));
    mocks.getMemberForOwner.mockRejectedValue(new Error("db down"));
    const result = await action(none, form());
    expect(result.error).toContain("this person");
  });
});
