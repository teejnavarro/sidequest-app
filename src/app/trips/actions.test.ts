import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTripAction, updateTripAction } from "./actions";
import { emptyTripValues } from "@/lib/trip-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createTrip: vi.fn(),
  updateTripForMember: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  createTrip: mocks.createTrip,
  updateTripForMember: mocks.updateTripForMember,
}));

const initial = { errors: {}, values: emptyTripValues };

const good = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
};

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
  mocks.createTrip.mockResolvedValue("trip-1");
  mocks.updateTripForMember.mockResolvedValue(true);
});

describe("createTripAction", () => {
  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(createTripAction(initial, formWith(good))).rejects.toThrow("redirect:/");
    expect(mocks.createTrip).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...good, name: "   ", endDate: "2027-03-01" };
    const state = await createTripAction(initial, formWith(typed));
    expect(state.errors.name).toBe("Please enter a trip name.");
    expect(state.errors.endDate).toBe("The end date can't be before the start date.");
    expect(state.values).toEqual(typed);
    expect(mocks.createTrip).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("creates the trip for the signed-in person and goes to it", async () => {
    await expect(createTripAction(initial, formWith(good))).rejects.toThrow(
      "redirect:/trips/trip-1",
    );
    expect(mocks.createTrip).toHaveBeenCalledWith("u1", good);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("ignores extra form fields such as ownerId", async () => {
    const form = formWith({ ...good, ownerId: "someone-else", id: "chosen-id" });
    await expect(createTripAction(initial, form)).rejects.toThrow("redirect:");
    expect(mocks.createTrip).toHaveBeenCalledWith("u1", good);
  });

  it("shows a plain message and keeps the values when saving fails", async () => {
    mocks.createTrip.mockRejectedValue(new Error("database down"));
    const state = await createTripAction(initial, formWith(good));
    expect(state.errors.form).toBe("Could not save the trip. Please try again.");
    expect(state.values).toEqual(good);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("updateTripAction", () => {
  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(
      updateTripAction(initial, formWith({ ...good, tripId: "trip-1" })),
    ).rejects.toThrow("redirect:/");
    expect(mocks.updateTripForMember).not.toHaveBeenCalled();
  });

  it("saves nothing for invalid input and gives back what was typed", async () => {
    const typed = { ...good, startDate: "2027-02-30" };
    const state = await updateTripAction(initial, formWith({ ...typed, tripId: "trip-1" }));
    expect(state.errors.startDate).toBeDefined();
    expect(state.values).toEqual(typed);
    expect(mocks.updateTripForMember).not.toHaveBeenCalled();
  });

  it("updates through the privacy layer as the signed-in person and goes to the trip", async () => {
    await expect(
      updateTripAction(initial, formWith({ ...good, tripId: "trip-1" })),
    ).rejects.toThrow("redirect:/trips/trip-1");
    expect(mocks.updateTripForMember).toHaveBeenCalledWith("trip-1", "u1", good);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1", "layout");
  });

  it("changes nothing for a non-member and says the trip was not found", async () => {
    mocks.updateTripForMember.mockResolvedValue(false);
    const state = await updateTripAction(initial, formWith({ ...good, tripId: "someone-elses" }));
    expect(state.errors.form).toBe("We couldn't find that trip.");
    expect(state.values).toEqual(good);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not even try to save without a trip id", async () => {
    const state = await updateTripAction(initial, formWith(good));
    expect(state.errors.form).toBe("We couldn't find that trip.");
    expect(mocks.updateTripForMember).not.toHaveBeenCalled();
  });

  it("ignores extra form fields such as ownerId", async () => {
    const form = formWith({ ...good, tripId: "trip-1", ownerId: "someone-else" });
    await expect(updateTripAction(initial, form)).rejects.toThrow("redirect:");
    expect(mocks.updateTripForMember).toHaveBeenCalledWith("trip-1", "u1", good);
  });
});
