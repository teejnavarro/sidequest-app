import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveAction,
  createIdeaAction,
  deleteIdeaAction,
  moveBackAction,
  updateIdeaAction,
  voteAction,
} from "./actions";
import { emptyIdeaValues } from "@/lib/idea-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
  setVote: vi.fn(),
  approveIdea: vi.fn(),
  unapproveIdea: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/ideas", () => ({
  createIdea: mocks.createIdea,
  updateIdea: mocks.updateIdea,
  deleteIdea: mocks.deleteIdea,
  setVote: mocks.setVote,
  approveIdea: mocks.approveIdea,
  unapproveIdea: mocks.unapproveIdea,
}));

const initial = { errors: {}, values: emptyIdeaValues };
const LIST = "redirect:/trips/trip-1/ideas";

const good = {
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: "https://maps.app.goo.gl/abc123",
  area: "District 1",
  costPerPerson: "120",
  notes: "Go early.",
};
const savedGood = { ...good, costPerPerson: 120 };

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
  mocks.createIdea.mockResolvedValue("idea-1");
  mocks.updateIdea.mockResolvedValue(true);
  mocks.deleteIdea.mockResolvedValue(true);
  mocks.setVote.mockResolvedValue({ up: 2, down: 0, myVote: 1 });
  mocks.approveIdea.mockResolvedValue(true);
  mocks.unapproveIdea.mockResolvedValue(true);
});

describe("createIdeaAction", () => {
  const form = (extra: Record<string, string> = {}) => formWith({ ...good, tripId: "trip-1", ...extra });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(createIdeaAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.createIdea).not.toHaveBeenCalled();
  });

  it("goes to My trips without saving when the trip id is missing", async () => {
    await expect(createIdeaAction(initial, formWith(good))).rejects.toThrow("redirect:/trips");
    expect(mocks.createIdea).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...good, name: "  ", type: "", link: "javascript:alert(1)", costPerPerson: "12.5" };
    const state = await createIdeaAction(initial, formWith({ ...typed, tripId: "trip-1" }));
    expect(state.errors).toMatchObject({
      name: "Please enter the idea.",
      type: "Pick a type.",
      link: "Paste a full link, starting with https://",
      costPerPerson: "Enter a whole amount, like 120.",
    });
    expect(state.values).toEqual(typed);
    expect(mocks.createIdea).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("adds the idea as the signed-in person to the named trip and goes to the list", async () => {
    await expect(createIdeaAction(initial, form())).rejects.toThrow(LIST);
    expect(mocks.createIdea).toHaveBeenCalledWith("trip-1", "u1", savedGood);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("ignores extra fields such as createdBy, id and costCurrency", async () => {
    await expect(
      createIdeaAction(initial, form({ createdBy: "someone-else", id: "chosen", costCurrency: "USD", userId: "x" })),
    ).rejects.toThrow(LIST);
    expect(mocks.createIdea).toHaveBeenCalledWith("trip-1", "u1", savedGood);
  });

  it("ends in the same place when the person is not in the trip (nothing is added)", async () => {
    mocks.createIdea.mockResolvedValue(null);
    await expect(
      createIdeaAction(initial, formWith({ ...good, tripId: "someone-elses-trip" })),
    ).rejects.toThrow("redirect:/trips/someone-elses-trip/ideas");
    expect(mocks.createIdea).toHaveBeenCalledWith("someone-elses-trip", "u1", savedGood);
  });

  it("shows a plain message and keeps the values when saving fails", async () => {
    mocks.createIdea.mockRejectedValue(new Error("database down"));
    const state = await createIdeaAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the idea. Please try again.");
    expect(state.values).toEqual(good);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateIdeaAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ ...good, tripId: "trip-1", ideaId: "idea-1", ...extra });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(updateIdeaAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.updateIdea).not.toHaveBeenCalled();
  });

  it("does not try to save without an idea id", async () => {
    await expect(
      updateIdeaAction(initial, formWith({ ...good, tripId: "trip-1" })),
    ).rejects.toThrow(LIST);
    expect(mocks.updateIdea).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...good, duration: "" };
    const state = await updateIdeaAction(initial, formWith({ ...typed, tripId: "trip-1", ideaId: "idea-1" }));
    expect(state.errors.duration).toBe("Pick how long it takes.");
    expect(state.values).toEqual(typed);
    expect(mocks.updateIdea).not.toHaveBeenCalled();
  });

  it("updates as the signed-in person and goes to the list", async () => {
    await expect(updateIdeaAction(initial, form())).rejects.toThrow(LIST);
    expect(mocks.updateIdea).toHaveBeenCalledWith("trip-1", "idea-1", "u1", savedGood);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("ignores extra fields such as createdBy", async () => {
    await expect(updateIdeaAction(initial, form({ createdBy: "someone-else" }))).rejects.toThrow(LIST);
    expect(mocks.updateIdea).toHaveBeenCalledWith("trip-1", "idea-1", "u1", savedGood);
  });

  it("ends in the same place when nothing changed (not yours, or not found)", async () => {
    mocks.updateIdea.mockResolvedValue(false);
    await expect(updateIdeaAction(initial, form())).rejects.toThrow(LIST);
  });

  it("shows a plain message and keeps the values when saving fails", async () => {
    mocks.updateIdea.mockRejectedValue(new Error("database down"));
    const state = await updateIdeaAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the idea. Please try again.");
    expect(state.values).toEqual(good);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("deleteIdeaAction", () => {
  const none = {};
  const form = (extra: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", ideaId: "idea-1", ...extra });

  it("deletes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(deleteIdeaAction(none, form())).rejects.toThrow("redirect:/");
    expect(mocks.deleteIdea).not.toHaveBeenCalled();
  });

  it("deletes nothing when an id is missing", async () => {
    await expect(deleteIdeaAction(none, formWith({ ideaId: "idea-1" }))).rejects.toThrow("redirect:/trips");
    await expect(deleteIdeaAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(LIST);
    expect(mocks.deleteIdea).not.toHaveBeenCalled();
  });

  it("deletes as the signed-in person and goes to the list", async () => {
    await expect(deleteIdeaAction(none, form())).rejects.toThrow(LIST);
    expect(mocks.deleteIdea).toHaveBeenCalledWith("trip-1", "idea-1", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("ignores extra fields such as userId", async () => {
    await expect(deleteIdeaAction(none, form({ userId: "the-adder", createdBy: "the-adder" }))).rejects.toThrow(LIST);
    expect(mocks.deleteIdea).toHaveBeenCalledWith("trip-1", "idea-1", "u1");
  });

  it("ends in the same place when nothing was deleted (not yours, or a repeat)", async () => {
    mocks.deleteIdea.mockResolvedValue(false);
    await expect(deleteIdeaAction(none, form())).rejects.toThrow(LIST);
  });

  it("shows a plain message and stays on the page when the delete fails", async () => {
    mocks.deleteIdea.mockRejectedValue(new Error("database down"));
    await expect(deleteIdeaAction(none, form())).resolves.toEqual({
      error: "Couldn't delete the idea. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("voteAction", () => {
  const form = (fields: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", ideaId: "idea-1", choice: "up", ...fields });

  it("does nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(voteAction(form())).rejects.toThrow("redirect:/");
    expect(mocks.setVote).not.toHaveBeenCalled();
  });

  it("returns the saved counts and does not revalidate the page", async () => {
    await expect(voteAction(form())).resolves.toEqual({ up: 2, down: 0, myVote: 1 });
    expect(mocks.setVote).toHaveBeenCalledWith("trip-1", "idea-1", "u1", 1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("turns 'down' into -1", async () => {
    await voteAction(form({ choice: "down" }));
    expect(mocks.setVote).toHaveBeenCalledWith("trip-1", "idea-1", "u1", -1);
  });

  it.each(["", "1", "UP", "sideways"])("refuses the choice %j", async (choice) => {
    await expect(voteAction(form({ choice }))).resolves.toEqual({
      error: "Couldn't save your vote. Please try again.",
    });
    expect(mocks.setVote).not.toHaveBeenCalled();
  });

  it("refuses a missing trip or idea id", async () => {
    await expect(voteAction(formWith({ ideaId: "idea-1", choice: "up" }))).resolves.toHaveProperty("error");
    await expect(voteAction(formWith({ tripId: "trip-1", choice: "up" }))).resolves.toHaveProperty("error");
    expect(mocks.setVote).not.toHaveBeenCalled();
  });

  it("ignores extra fields such as a user id", async () => {
    await voteAction(form({ userId: "someone-else", value: "99" }));
    expect(mocks.setVote).toHaveBeenCalledWith("trip-1", "idea-1", "u1", 1);
  });

  it("gives the error message when the person may not vote or the save fails", async () => {
    mocks.setVote.mockResolvedValue(null);
    await expect(voteAction(form())).resolves.toEqual({ error: "Couldn't save your vote. Please try again." });
    mocks.setVote.mockRejectedValue(new Error("db down"));
    await expect(voteAction(form())).resolves.toEqual({ error: "Couldn't save your vote. Please try again." });
  });
});

describe.each([
  ["approveAction", approveAction, mocks.approveIdea, mocks.unapproveIdea],
  ["moveBackAction", moveBackAction, mocks.unapproveIdea, mocks.approveIdea],
] as const)("%s", (_name, action, called, other) => {
  const form = (fields: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", ideaId: "idea-1", ...fields });

  it("does nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(action(form())).rejects.toThrow("redirect:/");
    expect(called).not.toHaveBeenCalled();
  });

  it("changes the idea with the signed-in person's id and redraws the Ideas tab", async () => {
    await action(form({ userId: "someone-else" }));
    expect(called).toHaveBeenCalledWith("trip-1", "idea-1", "u1");
    expect(other).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("returns nothing and reveals nothing when the change did not happen", async () => {
    called.mockResolvedValue(false);
    await expect(action(form())).resolves.toBeUndefined();
  });

  it("does nothing without both ids", async () => {
    await action(formWith({ tripId: "trip-1" }));
    await action(formWith({ ideaId: "idea-1" }));
    expect(called).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
