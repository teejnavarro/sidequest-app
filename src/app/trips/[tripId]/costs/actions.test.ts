import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteCostAction, reviewOrSaveCostAction } from "./actions";
import { emptyCostValues, type CostFormState } from "@/lib/cost-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listTripMembers: vi.fn(),
  createCost: vi.fn(),
  updateCost: vi.fn(),
  deleteCost: vi.fn(),
  getCostForMember: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  listTripMembers: mocks.listTripMembers,
}));
vi.mock("@/lib/costs", () => ({
  createCost: mocks.createCost,
  updateCost: mocks.updateCost,
  deleteCost: mocks.deleteCost,
  getCostForMember: mocks.getCostForMember,
}));

const initial: CostFormState = { errors: {}, values: emptyCostValues, review: null, notice: null, updatedAt: "" };
const LIST = "redirect:/trips/trip-1/costs";
const COST_ID = "7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44";
const OPENED = "2027-03-12T10:00:00.123Z";

// Spot a belongs to the signed-in person u1; b is another member; g is a guest.
const members = [
  { id: "u1", spotId: "a", name: "Maya Cruz", image: null, isGuest: false },
  { id: "u2", spotId: "b", name: "Ben Lim", image: null, isGuest: false },
  { id: "g", spotId: "g", name: "Dana", image: null, isGuest: true },
];

const good = {
  description: "Dinner",
  amount: "1,000",
  paidBy: "a",
  spentOn: "2027-03-12",
  category: "food",
};

function formWith(fields: Record<string, string>, sharedBy: string[] = ["a", "b", "g"]) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  for (const spot of sharedBy) form.append("sharedBy", spot);
  return form;
}

const saved = {
  id: COST_ID,
  description: "Dinner",
  amount: 100000,
  currency: "PHP",
  category: "food",
  spentOn: "2027-03-12",
  paidBy: "a",
  shares: [
    { spotId: "a", amount: 33334 },
    { spotId: "b", amount: 33333 },
    { spotId: "g", amount: 33333 },
  ],
  updatedAt: new Date(OPENED),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP" });
  mocks.listTripMembers.mockResolvedValue(members);
  mocks.createCost.mockResolvedValue("ok");
  mocks.updateCost.mockResolvedValue("ok");
  mocks.deleteCost.mockResolvedValue(true);
  mocks.getCostForMember.mockResolvedValue(saved);
});

describe("reviewOrSaveCostAction, new cost", () => {
  const form = (extra: Record<string, string> = {}, sharedBy?: string[]) =>
    formWith({ ...good, tripId: "trip-1", costId: COST_ID, mode: "new", step: "review", ...extra }, sharedBy);

  it("does nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(reviewOrSaveCostAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.createCost).not.toHaveBeenCalled();
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("goes to My trips when the trip id is missing, and back to the list for a bad cost id", async () => {
    await expect(
      reviewOrSaveCostAction(initial, formWith({ ...good, costId: COST_ID })),
    ).rejects.toThrow("redirect:/trips");
    await expect(reviewOrSaveCostAction(initial, form({ costId: "not-a-uuid" }))).rejects.toThrow(LIST);
    await expect(reviewOrSaveCostAction(initial, form({ costId: "" }))).rejects.toThrow(LIST);
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("keeps what was typed and says what is wrong, saving nothing", async () => {
    const state = await reviewOrSaveCostAction(
      initial,
      form({ description: "  ", amount: "12.345", paidBy: "stranger", spentOn: "soon", step: "save" }, []),
    );
    expect(state.errors).toMatchObject({
      description: "Please enter what it was.",
      amount: "Enter an amount, like 1,250.50.",
      paidBy: "Pick who paid.",
      sharedBy: "Pick who shares it.",
      spentOn: "Pick a date.",
    });
    expect(state.values).toMatchObject({ description: "  ", amount: "12.345", paidBy: "stranger", spentOn: "soon", sharedBy: [] });
    expect(state.review).toBeNull();
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("returns the review with exact shares and the extra centavo on the payer, saving nothing yet", async () => {
    const state = await reviewOrSaveCostAction(initial, form());
    expect(mocks.createCost).not.toHaveBeenCalled();
    expect(state.errors).toEqual({});
    expect(state.review).toMatchObject({
      kind: "new",
      currency: "PHP",
      amount: 100000,
      payer: { spotId: "a", name: "Maya", isYou: true },
      extraTakers: [{ spotId: "a", name: "Maya", isYou: true }],
      changes: [],
    });
    expect(state.review?.shares.map((s) => [s.name, s.amount])).toEqual([["Maya", 33334], ["Ben", 33333], ["Dana", 33333]]);
    expect(state.values.sharedBy).toEqual(["a", "b", "g"]);
  });

  it("saves as the signed-in person after checking again, ignoring extra and hidden fields", async () => {
    await expect(
      reviewOrSaveCostAction(
        initial,
        form({ step: "save", createdBy: "u2", updatedBy: "u2", currency: "USD", shares: "9", amountMinor: "1" }),
      ),
    ).rejects.toThrow(LIST);
    expect(mocks.createCost).toHaveBeenCalledTimes(1);
    expect(mocks.createCost).toHaveBeenCalledWith("trip-1", "u1", COST_ID, {
      description: "Dinner",
      amount: 100000,
      paidBy: "a",
      category: "food",
      spentOn: "2027-03-12",
      shares: [
        { spotId: "a", amount: 33334 },
        { spotId: "b", amount: 33333 },
        { spotId: "g", amount: 33333 },
      ],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
  });

  it("recomputes the shares on save instead of trusting the review, and refuses a stranger's spot", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ step: "save" }, ["a", "not-in-trip"]));
    expect(state.errors.sharedBy).toBe("Pick who shares it.");
    expect(mocks.createCost).not.toHaveBeenCalled();
    await expect(reviewOrSaveCostAction(initial, form({ step: "save", amount: "250" }, ["b"]))).rejects.toThrow(LIST);
    expect(mocks.createCost).toHaveBeenLastCalledWith("trip-1", "u1", COST_ID, expect.objectContaining({ amount: 25000, shares: [{ spotId: "b", amount: 25000 }] }));
  });

  it("uses the trip's currency, so a zero-decimal trip takes whole amounts only", async () => {
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "VND" });
    const state = await reviewOrSaveCostAction(initial, form({ amount: "250.5" }));
    expect(state.errors.amount).toBe("Enter an amount, like 1,250.");
    const ok = await reviewOrSaveCostAction(initial, form({ amount: "250,000" }));
    expect(ok.review).toMatchObject({ currency: "VND", amount: 250000 });
  });

  it("ends at the Costs tab, saving nothing, when the person is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(reviewOrSaveCostAction(initial, form({ step: "save" }))).rejects.toThrow(LIST);
    expect(mocks.createCost).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a plain message and keeps the values when saving throws, with no redirect", async () => {
    mocks.createCost.mockRejectedValue(new Error("database down"));
    const state = await reviewOrSaveCostAction(initial, form({ step: "save" }));
    expect(state.errors.form).toBe("Couldn't save the cost. Please try again.");
    expect(state.values).toMatchObject({ description: "Dinner", amount: "1,000", sharedBy: ["a", "b", "g"] });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("shows the same message when looking up the trip throws", async () => {
    mocks.getTripForMember.mockRejectedValue(new Error("database down"));
    const state = await reviewOrSaveCostAction(initial, form());
    expect(state.errors.form).toBe("Couldn't save the cost. Please try again.");
  });
});

describe("reviewOrSaveCostAction, edit", () => {
  const form = (extra: Record<string, string> = {}, sharedBy?: string[]) =>
    formWith(
      { ...good, tripId: "trip-1", costId: COST_ID, mode: "edit", step: "review", updatedAt: OPENED, ...extra },
      sharedBy,
    );

  it("returns the changes against the saved cost, only for fields that changed", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ amount: "3500", description: "Dinner and drinks" }));
    expect(mocks.getCostForMember).toHaveBeenCalledWith("trip-1", COST_ID, "u1");
    expect(state.review?.kind).toBe("edit");
    expect(state.review?.changes).toEqual([
      { field: "amount", before: "₱1,000.00", after: "₱3,500.00" },
      { field: "description", before: "Dinner", after: "Dinner and drinks" },
    ]);
    expect(state.review?.shareChanges.map((c) => [c.person.name, c.before, c.after])).toEqual([
      ["Maya", 33334, 116667],
      ["Ben", 33333, 116667],
      ["Dana", 33333, 116666],
    ]);
    expect(state.updatedAt).toBe(OPENED);
    expect(mocks.updateCost).not.toHaveBeenCalled();
  });

  it("saves with the time the person opened it, as the signed-in person", async () => {
    await expect(reviewOrSaveCostAction(initial, form({ step: "save", amount: "3500" }))).rejects.toThrow(LIST);
    expect(mocks.updateCost).toHaveBeenCalledWith(
      "trip-1",
      COST_ID,
      "u1",
      expect.objectContaining({ amount: 350000 }),
      new Date(OPENED),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
  });

  it("shows 'Someone just changed this cost' with the fresh values when the save is stale", async () => {
    const fresh = { ...saved, description: "Dinner (changed)", amount: 125050, updatedAt: new Date("2027-03-12T11:00:00.000Z") };
    mocks.updateCost.mockResolvedValue("changed");
    mocks.getCostForMember.mockResolvedValue(fresh);
    const state = await reviewOrSaveCostAction(initial, form({ step: "save" }));
    expect(state.notice).toBe("Someone just changed this cost. Check it again.");
    expect(state.values).toEqual({
      description: "Dinner (changed)",
      amount: "1250.50",
      paidBy: "a",
      sharedBy: ["a", "b", "g"],
      spentOn: "2027-03-12",
      category: "food",
    });
    expect(state.updatedAt).toBe("2027-03-12T11:00:00.000Z");
    expect(state.review).toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("also says changed at the review step when the cost was saved since it was opened", async () => {
    mocks.getCostForMember.mockResolvedValue({ ...saved, updatedAt: new Date("2027-03-12T11:00:00.000Z") });
    const state = await reviewOrSaveCostAction(initial, form());
    expect(state.notice).toBe("Someone just changed this cost. Check it again.");
    expect(state.review).toBeNull();
  });

  it("treats a missing or garbled opened-time as changed at review, and ends at the list on save", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ updatedAt: "yesterday" }));
    expect(state.notice).toBe("Someone just changed this cost. Check it again.");
    await expect(reviewOrSaveCostAction(initial, form({ updatedAt: "", step: "save" }))).rejects.toThrow(LIST);
    expect(mocks.updateCost).not.toHaveBeenCalled();
  });

  it("goes back to the list when the cost is gone", async () => {
    mocks.getCostForMember.mockResolvedValue(null);
    await expect(reviewOrSaveCostAction(initial, form())).rejects.toThrow(LIST);
    mocks.updateCost.mockResolvedValue("changed");
    await expect(reviewOrSaveCostAction(initial, form({ step: "save" }))).rejects.toThrow(LIST);
  });

  it("keeps the values and the opened-time on a validation error", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ amount: "" }));
    expect(state.errors.amount).toBe("Enter an amount, like 1,250.50.");
    expect(state.updatedAt).toBe(OPENED);
    expect(mocks.updateCost).not.toHaveBeenCalled();
  });

  it("shows a plain message when saving throws", async () => {
    mocks.updateCost.mockRejectedValue(new Error("database down"));
    const state = await reviewOrSaveCostAction(initial, form({ step: "save" }));
    expect(state.errors.form).toBe("Couldn't save the cost. Please try again.");
    expect(state.updatedAt).toBe(OPENED);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("deleteCostAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", costId: COST_ID, ...extra }, []);

  it("deletes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(deleteCostAction({}, form())).rejects.toThrow("redirect:/");
    expect(mocks.deleteCost).not.toHaveBeenCalled();
  });

  it("goes back without deleting when an id is missing", async () => {
    await expect(deleteCostAction({}, formWith({ costId: COST_ID }, []))).rejects.toThrow("redirect:/trips");
    await expect(deleteCostAction({}, formWith({ tripId: "trip-1" }, []))).rejects.toThrow(LIST);
    expect(mocks.deleteCost).not.toHaveBeenCalled();
  });

  it("deletes as the signed-in person, ignoring extra fields, and goes to the Costs tab", async () => {
    await expect(deleteCostAction({}, form({ userId: "u2" }))).rejects.toThrow(LIST);
    expect(mocks.deleteCost).toHaveBeenCalledWith("trip-1", COST_ID, "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
  });

  it("ends in the same place when nothing was deleted", async () => {
    mocks.deleteCost.mockResolvedValue(false);
    await expect(deleteCostAction({}, form())).rejects.toThrow(LIST);
  });

  it("shows a plain message when the delete throws", async () => {
    mocks.deleteCost.mockRejectedValue(new Error("database down"));
    await expect(deleteCostAction({}, form())).resolves.toEqual({
      error: "Couldn't delete the cost. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
