import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTripAction, deleteTripAction, updateTripAction } from "./actions";
import { emptyTripValues } from "@/lib/trip-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createTrip: vi.fn(),
  updateTripForMember: vi.fn(),
  deleteTripForOwner: vi.fn(),
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
  deleteTripForOwner: mocks.deleteTripForOwner,
}));

const initial = { errors: {}, values: emptyTripValues };

const good = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  destination: "Đà Nẵng, Việt Nam",
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
    expect(state.errors.endDate).toBe("The day you're back can't be before the day you leave.");
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
    expect(state.errors.form).toBe("Couldn't save the trip. Please try again.");
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

  it("clears the destination when the box is emptied on edit", async () => {
    const form = formWith({ ...good, destination: "", tripId: "trip-1" });
    await expect(updateTripAction(initial, form)).rejects.toThrow("redirect:/trips/trip-1");
    expect(mocks.updateTripForMember).toHaveBeenCalledWith("trip-1", "u1", {
      ...good,
      destination: null,
    });
  });

  it("saves nothing when the destination is too long, and keeps what was typed", async () => {
    const typed = { ...good, destination: "x".repeat(61), tripId: "trip-1" };
    const state = await updateTripAction(initial, formWith(typed));
    expect(state.errors.destination).toBe("Keep it to 60 characters or fewer.");
    expect(state.values.destination).toBe("x".repeat(61));
    expect(mocks.updateTripForMember).not.toHaveBeenCalled();
  });
});

describe("destination on create", () => {
  it("is optional: a trip without one is created with none", async () => {
    const { destination: _unused, ...withoutDestination } = good;
    void _unused;
    await expect(createTripAction(initial, formWith(withoutDestination))).rejects.toThrow(
      "redirect:/trips/trip-1",
    );
    expect(mocks.createTrip).toHaveBeenCalledWith("u1", { ...withoutDestination, destination: null });
  });

  it("keeps the accents in the destination exactly", async () => {
    await expect(createTripAction(initial, formWith(good))).rejects.toThrow("redirect:");
    expect(mocks.createTrip.mock.calls[0][1].destination).toBe("Đà Nẵng, Việt Nam");
  });
});

describe("deleteTripAction", () => {
  const none = {};

  beforeEach(() => {
    mocks.deleteTripForOwner.mockResolvedValue(true);
  });

  it("deletes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(deleteTripAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(
      "redirect:/",
    );
    expect(mocks.deleteTripForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["empty", { tripId: "" }],
  ])("deletes nothing when the trip id is %s", async (_label, fields) => {
    await expect(deleteTripAction(none, formWith(fields))).rejects.toThrow("redirect:/trips");
    expect(mocks.deleteTripForOwner).not.toHaveBeenCalled();
  });

  it("deletes as the signed-in person and goes to My trips", async () => {
    await expect(deleteTripAction(none, formWith({ tripId: "trip-1" }))).rejects.toThrow(
      "redirect:/trips",
    );
    expect(mocks.deleteTripForOwner).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("ignores extra form fields such as userId and ownerId", async () => {
    const form = formWith({ tripId: "trip-1", userId: "the-owner", ownerId: "the-owner" });
    await expect(deleteTripAction(none, form)).rejects.toThrow("redirect:/trips");
    expect(mocks.deleteTripForOwner).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("ends in the same place when nothing was deleted (a member, a stranger or a repeat)", async () => {
    mocks.deleteTripForOwner.mockResolvedValue(false);
    await expect(deleteTripAction(none, formWith({ tripId: "someone-elses" }))).rejects.toThrow(
      "redirect:/trips",
    );
  });

  it("shows a plain message and stays on the page when the delete fails", async () => {
    mocks.deleteTripForOwner.mockRejectedValue(new Error("database down"));
    await expect(deleteTripAction(none, formWith({ tripId: "trip-1" }))).resolves.toEqual({
      error: "Couldn't delete the trip. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
