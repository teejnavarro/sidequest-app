import { beforeEach, describe, expect, it, vi } from "vitest";
import { addGuestAction, removeGuestAction, renameGuestAction } from "./actions";
import { emptyGuestForm } from "@/lib/guest-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  addGuest: vi.fn(),
  renameGuest: vi.fn(),
  removeGuest: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  addGuest: mocks.addGuest,
  renameGuest: mocks.renameGuest,
  removeGuest: mocks.removeGuest,
}));

const PEOPLE = "redirect:/trips/trip-1/invite#people";

function formWith(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

function expectRefreshed() {
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1", "layout");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/invite");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.addGuest.mockResolvedValue("ok");
  mocks.renameGuest.mockResolvedValue("ok");
  mocks.removeGuest.mockResolvedValue(true);
});

describe("addGuestAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ name: "  Dana   Cruz ", tripId: "trip-1", ...extra });

  it("changes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(addGuestAction(emptyGuestForm, form())).rejects.toThrow("redirect:/");
    expect(mocks.addGuest).not.toHaveBeenCalled();
  });

  it("goes to My trips without saving when the trip id is missing", async () => {
    await expect(addGuestAction(emptyGuestForm, formWith({ name: "Dana" }))).rejects.toThrow(
      "redirect:/trips",
    );
    expect(mocks.addGuest).not.toHaveBeenCalled();
  });

  it("saves nothing for a blank or too long name and keeps what was typed", async () => {
    await expect(addGuestAction(emptyGuestForm, form({ name: "   " }))).resolves.toEqual({
      error: "Please enter a name.",
      name: "   ",
    });
    const long = "a".repeat(41);
    await expect(addGuestAction(emptyGuestForm, form({ name: long }))).resolves.toEqual({
      error: "Keep it to 40 characters or fewer.",
      name: long,
    });
    expect(mocks.addGuest).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("adds the tidied name as the signed-in person, refreshes the pages and goes to the people list", async () => {
    await expect(addGuestAction(emptyGuestForm, form())).rejects.toThrow(PEOPLE);
    expect(mocks.addGuest).toHaveBeenCalledWith("trip-1", "u1", "Dana Cruz");
    expectRefreshed();
  });

  it("ignores extra fields such as userId, addedBy and spotId", async () => {
    await expect(
      addGuestAction(emptyGuestForm, form({ userId: "x", addedBy: "someone-else", spotId: "s" })),
    ).rejects.toThrow(PEOPLE);
    expect(mocks.addGuest).toHaveBeenCalledWith("trip-1", "u1", "Dana Cruz");
  });

  it("names the clash for a duplicate and keeps what was typed", async () => {
    mocks.addGuest.mockResolvedValue("duplicate");
    await expect(addGuestAction(emptyGuestForm, form({ name: " dana " }))).resolves.toEqual({
      error: "There's already a guest called dana.",
      name: " dana ",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a plain message when the save throws, keeping the typed name", async () => {
    mocks.addGuest.mockRejectedValue(new Error("database down"));
    await expect(addGuestAction(emptyGuestForm, form())).resolves.toEqual({
      error: "Couldn't save the guest. Please try again.",
      name: "  Dana   Cruz ",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("ends in the same place when the person isn't in the trip", async () => {
    mocks.addGuest.mockResolvedValue("not-found");
    await expect(addGuestAction(emptyGuestForm, form())).rejects.toThrow(PEOPLE);
  });
});

describe("renameGuestAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ name: "Dana C", tripId: "trip-1", spotId: "spot-1", ...extra });

  it("changes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renameGuestAction(emptyGuestForm, form())).rejects.toThrow("redirect:/");
    expect(mocks.renameGuest).not.toHaveBeenCalled();
  });

  it("goes back without saving when an id is missing", async () => {
    await expect(
      renameGuestAction(emptyGuestForm, formWith({ name: "Dana" })),
    ).rejects.toThrow("redirect:/trips");
    await expect(
      renameGuestAction(emptyGuestForm, formWith({ name: "Dana", tripId: "trip-1" })),
    ).rejects.toThrow(PEOPLE);
    expect(mocks.renameGuest).not.toHaveBeenCalled();
  });

  it("saves nothing for a bad name and keeps what was typed", async () => {
    await expect(renameGuestAction(emptyGuestForm, form({ name: "" }))).resolves.toEqual({
      error: "Please enter a name.",
      name: "",
    });
    expect(mocks.renameGuest).not.toHaveBeenCalled();
  });

  it("renames as the signed-in person, ignoring extra fields, and goes to the people list", async () => {
    await expect(
      renameGuestAction(emptyGuestForm, form({ userId: "x", addedBy: "y" })),
    ).rejects.toThrow(PEOPLE);
    expect(mocks.renameGuest).toHaveBeenCalledWith("trip-1", "spot-1", "u1", "Dana C");
    expectRefreshed();
  });

  it("names the clash for a duplicate and keeps what was typed", async () => {
    mocks.renameGuest.mockResolvedValue("duplicate");
    await expect(renameGuestAction(emptyGuestForm, form())).resolves.toEqual({
      error: "There's already a guest called Dana C.",
      name: "Dana C",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows a plain message when the save throws", async () => {
    mocks.renameGuest.mockRejectedValue(new Error("database down"));
    await expect(renameGuestAction(emptyGuestForm, form())).resolves.toEqual({
      error: "Couldn't save the guest. Please try again.",
      name: "Dana C",
    });
  });

  it("ends in the same place when the change was refused", async () => {
    mocks.renameGuest.mockResolvedValue("not-found");
    await expect(renameGuestAction(emptyGuestForm, form())).rejects.toThrow(PEOPLE);
  });
});

describe("removeGuestAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", spotId: "spot-1", ...extra });

  it("changes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(removeGuestAction({}, form())).rejects.toThrow("redirect:/");
    expect(mocks.removeGuest).not.toHaveBeenCalled();
  });

  it("goes back without removing when an id is missing", async () => {
    await expect(removeGuestAction({}, formWith({ spotId: "spot-1" }))).rejects.toThrow(
      "redirect:/trips",
    );
    await expect(removeGuestAction({}, formWith({ tripId: "trip-1" }))).rejects.toThrow(PEOPLE);
    expect(mocks.removeGuest).not.toHaveBeenCalled();
  });

  it("removes as the signed-in person, ignoring extra fields, and goes to the people list", async () => {
    await expect(removeGuestAction({}, form({ userId: "x" }))).rejects.toThrow(PEOPLE);
    expect(mocks.removeGuest).toHaveBeenCalledWith("trip-1", "spot-1", "u1");
    expectRefreshed();
  });

  it("ends in the same place when the removal was refused", async () => {
    mocks.removeGuest.mockResolvedValue(false);
    await expect(removeGuestAction({}, form())).rejects.toThrow(PEOPLE);
  });

  it("shows a plain message when the removal throws", async () => {
    mocks.removeGuest.mockRejectedValue(new Error("database down"));
    await expect(removeGuestAction({}, form())).resolves.toEqual({
      error: "Couldn't remove the guest. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
