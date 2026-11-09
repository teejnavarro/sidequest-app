import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToScheduleAction, moveScheduleItemAction, removeScheduleItemAction } from "./actions";
import { emptyScheduleValues } from "@/lib/schedule-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  addIdeaToSchedule: vi.fn(),
  addNewItem: vi.fn(),
  getScheduleItemForMember: vi.fn(),
  moveScheduleItem: vi.fn(),
  removeScheduleItem: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/schedule", () => ({
  addIdeaToSchedule: mocks.addIdeaToSchedule,
  addNewItem: mocks.addNewItem,
  getScheduleItemForMember: mocks.getScheduleItemForMember,
  moveScheduleItem: mocks.moveScheduleItem,
  removeScheduleItem: mocks.removeScheduleItem,
}));

const initial = { errors: {}, values: emptyScheduleValues };
const LIST = "redirect:/trips/trip-1/schedule";
const DAY_9 = "redirect:/trips/trip-1/schedule#day-2027-05-09";

const newItem = {
  kind: "new",
  ideaId: "",
  name: "Airport transfer",
  notes: "Meet at arrivals.",
  day: "2027-05-09",
  slot: "time",
  time: "19:30",
};
const ideaItem = { ...emptyScheduleValues, kind: "idea", ideaId: "idea-1", day: "2027-05-09", slot: "morning" };

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
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", startDate: "2027-05-08", endDate: "2027-05-10" });
  mocks.addIdeaToSchedule.mockResolvedValue("item-1");
  mocks.addNewItem.mockResolvedValue("item-1");
  mocks.getScheduleItemForMember.mockResolvedValue({
    id: "item-1",
    ideaId: null,
    fromIdea: false,
    day: "2027-05-08",
  });
  mocks.moveScheduleItem.mockResolvedValue(true);
  mocks.removeScheduleItem.mockResolvedValue(true);
});

describe("addToScheduleAction", () => {
  const form = (fields: Record<string, string> = newItem, extra: Record<string, string> = {}) =>
    formWith({ ...fields, tripId: "trip-1", ...extra });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(addToScheduleAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.addNewItem).not.toHaveBeenCalled();
    expect(mocks.addIdeaToSchedule).not.toHaveBeenCalled();
  });

  it("goes to My trips without saving when the trip id is missing", async () => {
    await expect(addToScheduleAction(initial, formWith(newItem))).rejects.toThrow("redirect:/trips");
    expect(mocks.addNewItem).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...newItem, name: "  ", day: "2030-01-01", time: "7:30" };
    const state = await addToScheduleAction(initial, form(typed));
    expect(state.errors).toMatchObject({
      name: "Please enter a name.",
      day: "Pick a day.",
      time: "Enter a time, like 19:30.",
    });
    expect(state.values).toEqual(typed);
    expect(mocks.addNewItem).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("adds a new item as the signed-in person and goes to that day", async () => {
    await expect(addToScheduleAction(initial, form())).rejects.toThrow(DAY_9);
    expect(mocks.addNewItem).toHaveBeenCalledWith("trip-1", "u1", {
      kind: "new",
      name: "Airport transfer",
      notes: "Meet at arrivals.",
      day: "2027-05-09",
      slot: "time",
      time: "19:30",
    });
    expect(mocks.addIdeaToSchedule).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/schedule");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("adds an approved idea and ignores a name sent with it", async () => {
    await expect(addToScheduleAction(initial, form({ ...ideaItem, name: "Ignored" }))).rejects.toThrow(DAY_9);
    expect(mocks.addIdeaToSchedule).toHaveBeenCalledWith("trip-1", "u1", {
      kind: "idea",
      ideaId: "idea-1",
      day: "2027-05-09",
      slot: "morning",
      time: null,
    });
    expect(mocks.addNewItem).not.toHaveBeenCalled();
  });

  it("ignores extra fields such as updatedBy, id and tripId inside values", async () => {
    await expect(
      addToScheduleAction(initial, form(newItem, { updatedBy: "someone-else", id: "chosen", userId: "x" })),
    ).rejects.toThrow(DAY_9);
    expect(mocks.addNewItem).toHaveBeenCalledWith("trip-1", "u1", expect.not.objectContaining({ updatedBy: expect.anything() }));
    expect(JSON.stringify(mocks.addNewItem.mock.calls)).not.toContain("someone-else");
  });

  it("changes nothing and goes to the schedule when the person is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(addToScheduleAction(initial, form())).rejects.toThrow(LIST);
    expect(mocks.addNewItem).not.toHaveBeenCalled();
  });

  it("ends in the same place when nothing was added (not approved, or already scheduled)", async () => {
    mocks.addIdeaToSchedule.mockResolvedValue(null);
    await expect(addToScheduleAction(initial, form(ideaItem))).rejects.toThrow(DAY_9);
  });

  it("shows a plain message and keeps the values when saving fails", async () => {
    mocks.addNewItem.mockRejectedValue(new Error("database down"));
    const state = await addToScheduleAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the schedule. Please try again.");
    expect(state.values).toEqual(newItem);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the same message when the trip cannot be read", async () => {
    mocks.getTripForMember.mockRejectedValue(new Error("database down"));
    const state = await addToScheduleAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the schedule. Please try again.");
  });
});

describe("moveScheduleItemAction", () => {
  const form = (fields: Record<string, string> = newItem, extra: Record<string, string> = {}) =>
    formWith({ ...fields, tripId: "trip-1", itemId: "item-1", ...extra });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(moveScheduleItemAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.moveScheduleItem).not.toHaveBeenCalled();
  });

  it("does not try to save without a trip id or an item id", async () => {
    await expect(moveScheduleItemAction(initial, formWith({ ...newItem, itemId: "item-1" }))).rejects.toThrow(
      "redirect:/trips",
    );
    await expect(moveScheduleItemAction(initial, formWith({ ...newItem, tripId: "trip-1" }))).rejects.toThrow(LIST);
    expect(mocks.moveScheduleItem).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...newItem, slot: "" };
    const state = await moveScheduleItemAction(initial, form(typed));
    expect(state.errors.slot).toBe("Pick when.");
    expect(state.values).toEqual(typed);
    expect(mocks.moveScheduleItem).not.toHaveBeenCalled();
  });

  it("moves a new item as the signed-in person and goes to the new day", async () => {
    await expect(moveScheduleItemAction(initial, form())).rejects.toThrow(DAY_9);
    expect(mocks.moveScheduleItem).toHaveBeenCalledWith("trip-1", "item-1", "u1", {
      kind: "new",
      name: "Airport transfer",
      notes: "Meet at arrivals.",
      day: "2027-05-09",
      slot: "time",
      time: "19:30",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/schedule");
  });

  it("takes the kind from the saved item, not from the form", async () => {
    mocks.getScheduleItemForMember.mockResolvedValue({ id: "item-1", ideaId: "idea-1", fromIdea: true, day: "2027-05-08" });
    await expect(
      moveScheduleItemAction(initial, form({ ...newItem, kind: "new", name: "Renamed by a visitor" })),
    ).rejects.toThrow(DAY_9);
    expect(mocks.moveScheduleItem).toHaveBeenCalledWith("trip-1", "item-1", "u1", {
      kind: "idea",
      ideaId: "idea-1",
      day: "2027-05-09",
      slot: "time",
      time: "19:30",
    });
  });

  it("ignores extra fields such as updatedBy", async () => {
    await expect(moveScheduleItemAction(initial, form(newItem, { updatedBy: "someone-else" }))).rejects.toThrow(DAY_9);
    expect(JSON.stringify(mocks.moveScheduleItem.mock.calls)).not.toContain("someone-else");
  });

  it("changes nothing when the person is not in the trip or the item is not found", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(moveScheduleItemAction(initial, form())).rejects.toThrow(LIST);
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", startDate: "2027-05-08", endDate: "2027-05-10" });
    mocks.getScheduleItemForMember.mockResolvedValue(null);
    await expect(moveScheduleItemAction(initial, form())).rejects.toThrow(LIST);
    expect(mocks.moveScheduleItem).not.toHaveBeenCalled();
  });

  it("ends in the same place when the move changed nothing", async () => {
    mocks.moveScheduleItem.mockResolvedValue(false);
    await expect(moveScheduleItemAction(initial, form())).rejects.toThrow(DAY_9);
  });

  it("shows a plain message and keeps the values when saving fails", async () => {
    mocks.moveScheduleItem.mockRejectedValue(new Error("database down"));
    const state = await moveScheduleItemAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the schedule. Please try again.");
    expect(state.values).toEqual(newItem);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeScheduleItemAction", () => {
  const none = {};
  const form = (extra: Record<string, string> = {}) => formWith({ tripId: "trip-1", itemId: "item-1", ...extra });

  it("removes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(removeScheduleItemAction(none, form())).rejects.toThrow("redirect:/");
    expect(mocks.removeScheduleItem).not.toHaveBeenCalled();
  });

  it("removes nothing when an id is missing", async () => {
    await expect(removeScheduleItemAction(none, formWith({ itemId: "item-1" }))).rejects.toThrow("redirect:/trips");
    await expect(removeScheduleItemAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(LIST);
    expect(mocks.removeScheduleItem).not.toHaveBeenCalled();
  });

  it("removes as the signed-in person and goes back to the item's day", async () => {
    await expect(removeScheduleItemAction(none, form())).rejects.toThrow("redirect:/trips/trip-1/schedule#day-2027-05-08");
    expect(mocks.removeScheduleItem).toHaveBeenCalledWith("trip-1", "item-1", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/schedule");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/ideas");
  });

  it("ignores extra fields such as userId", async () => {
    await expect(removeScheduleItemAction(none, form({ userId: "someone-else" }))).rejects.toThrow("#day-2027-05-08");
    expect(mocks.removeScheduleItem).toHaveBeenCalledWith("trip-1", "item-1", "u1");
  });

  it("ends at the schedule when the item is not found or already gone", async () => {
    mocks.getScheduleItemForMember.mockResolvedValue(null);
    mocks.removeScheduleItem.mockResolvedValue(false);
    await expect(removeScheduleItemAction(none, form())).rejects.toThrow(LIST);
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("shows a plain message and stays on the page when the removal fails", async () => {
    mocks.removeScheduleItem.mockRejectedValue(new Error("database down"));
    await expect(removeScheduleItemAction(none, form())).resolves.toEqual({
      error: "Couldn't save the schedule. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
