import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIdeaAction, deleteIdeaAction, updateIdeaAction } from "./actions";
import { emptyIdeaValues } from "@/lib/idea-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
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
