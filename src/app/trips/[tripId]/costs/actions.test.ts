import { beforeEach, describe, expect, it, vi } from "vitest";
import { addCostPhotoAction, deleteCostAction, restoreCostAction, reviewOrSaveCostAction } from "./actions";
import { emptyCostValues, type CostFormState } from "@/lib/cost-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listCostPeople: vi.fn(),
  createCost: vi.fn(),
  updateCost: vi.fn(),
  deleteCost: vi.fn(),
  restoreCost: vi.fn(),
  getCostForMember: vi.fn(),
  setCostPhotoForMember: vi.fn(),
  putImage: vi.fn(),
  deleteImages: vi.fn(),
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
  listCostPeople: mocks.listCostPeople,
}));
vi.mock("@/lib/costs", () => ({
  createCost: mocks.createCost,
  updateCost: mocks.updateCost,
  deleteCost: mocks.deleteCost,
  restoreCost: mocks.restoreCost,
  getCostForMember: mocks.getCostForMember,
  setCostPhotoForMember: mocks.setCostPhotoForMember,
}));
vi.mock("@/lib/blob-store", () => ({ putImage: mocks.putImage, deleteImages: mocks.deleteImages }));

const initial: CostFormState = { errors: {}, values: emptyCostValues, review: null, notice: null, updatedAt: "" };
const LIST = "redirect:/trips/trip-1/costs";
const BREAKDOWN = `${LIST}/7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44`;
const COST_ID = "7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44";
const OPENED = "2027-03-12T10:00:00.123Z";

// Spot a belongs to the signed-in person u1; b is another member; g is a guest.
const members = [
  { id: "u1", spotId: "a", name: "Maya Cruz", image: null, isGuest: false, hasLeft: false },
  { id: "u2", spotId: "b", name: "Ben Lim", image: null, isGuest: false, hasLeft: false },
  { id: "g", spotId: "g", name: "Dana", image: null, isGuest: true, hasLeft: false },
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
  original: null,
  shares: [
    { spotId: "a", amount: 33334, originalAmount: null },
    { spotId: "b", amount: 33333, originalAmount: null },
    { spotId: "g", amount: 33333, originalAmount: null },
  ],
  updatedAt: new Date(OPENED),
  hasPhoto: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP" });
  mocks.listCostPeople.mockResolvedValue(members);
  mocks.createCost.mockResolvedValue("ok");
  mocks.updateCost.mockResolvedValue({ ok: true, oldPhoto: null });
  mocks.putImage.mockResolvedValue("cost-photos/new.jpg");
  mocks.setCostPhotoForMember.mockResolvedValue({ ok: true, old: null });
  mocks.deleteCost.mockResolvedValue(true);
  mocks.getCostForMember.mockResolvedValue(saved);
});

describe("reviewOrSaveCostAction, uneven split", () => {
  const form = (extra: Record<string, string> = {}, sharedBy?: string[]) =>
    formWith(
      { ...good, amount: "1,860", tripId: "trip-1", costId: COST_ID, mode: "new", step: "review", split: "items", ...extra },
      sharedBy,
    );

  it("reviews what each person had, and saves the same shares from the named fields", async () => {
    const own = { "own:a": "700", "own:g": "300" };
    const review = await reviewOrSaveCostAction(initial, form(own));
    expect(review.errors).toEqual({});
    expect(review.review).toMatchObject({ uneven: true, rest: 86000 });
    expect(review.review?.shares.map((s) => s.own)).toEqual([70000, 0, 30000]);
    expect(review.values).toMatchObject({ split: "items", own: { a: "700", b: "", g: "300" } });

    await expect(reviewOrSaveCostAction(initial, form({ ...own, step: "save" }))).rejects.toThrow(LIST);
    const input = mocks.createCost.mock.calls[0][3];
    expect(input.shares).toEqual([
      { spotId: "a", amount: 98667, originalAmount: null },
      { spotId: "b", amount: 28667, originalAmount: null },
      { spotId: "g", amount: 58666, originalAmount: null },
    ]);
  });

  it("says when the own amounts are over the total, and saves nothing", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ "own:a": "2,000", step: "save" }));
    expect(state.errors.own).toBe("That's ₱140.00 more than the total.");
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("reads own boxes only for ticked people", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ "own:a": "700", "own:g": "9,999", "own:zzz": "5" }, ["a", "b"]));
    expect(state.review?.shares.map((s) => s.own)).toEqual([70000, 0]);
    expect(state.values.own).toEqual({ a: "700", b: "" });
  });

  it("ignores own boxes when the split is equal", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ split: "equal", "own:a": "9,999" }));
    expect(state.errors).toEqual({});
    expect(state.review?.uneven).toBe(false);
    expect(state.review?.shares.map((s) => s.amount)).toEqual([62000, 62000, 62000]);
  });

  it("names the viewer as You in an own-amount error", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ "own:a": "x" }));
    expect(state.errors.own).toBe("Check your amount. Enter an amount, like 1,250.50.");
  });
});

describe("reviewOrSaveCostAction, new cost", () => {
  const form = (extra: Record<string, string> = {}, sharedBy?: string[]) =>
    formWith({ ...good, tripId: "trip-1", costId: COST_ID, mode: "new", step: "review", ...extra }, sharedBy);

  it("does nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(reviewOrSaveCostAction(initial, form())).rejects.toThrow("redirect:/");
    expect(mocks.createCost).not.toHaveBeenCalled();
    expect(mocks.listCostPeople).not.toHaveBeenCalled();
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

  it("reads the currency, fx, rate and charged fields and saves the converted cost", async () => {
    const send = (extra: Record<string, string>) =>
      reviewOrSaveCostAction(initial, form({ currency: "VND", amount: "870,000", rate: "435", ...extra }));
    const review = await send({});
    expect(review.errors).toEqual({});
    expect(review.values).toMatchObject({ currency: "VND", fx: "rate", rate: "435", charged: "" });
    await expect(send({ step: "save" })).rejects.toThrow(LIST);
    expect(mocks.createCost).toHaveBeenLastCalledWith(
      "trip-1",
      "u1",
      COST_ID,
      expect.objectContaining({ amount: 200000, money: { kind: "rate", currency: "VND", original: 870000, rate: "435" } }),
      "keep",
    );
    const card = await send({ fx: "charged", charged: "bad" });
    expect(card.errors.charged).toBe("Enter an amount, like 1,250.50.");
    expect(card.values.fx).toBe("charged");
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
        form({ step: "save", createdBy: "u2", updatedBy: "u2", tripCurrency: "USD", shares: "9", amountMinor: "1" }),
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
        { spotId: "a", amount: 33334, originalAmount: null },
        { spotId: "b", amount: 33333, originalAmount: null },
        { spotId: "g", amount: 33333, originalAmount: null },
      ],
      ownParts: null,
      money: { kind: "trip" },
    }, "keep");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
  });

  it("recomputes the shares on save instead of trusting the review, and refuses a stranger's spot", async () => {
    const state = await reviewOrSaveCostAction(initial, form({ step: "save" }, ["a", "not-in-trip"]));
    expect(state.errors.sharedBy).toBe("Pick who shares it.");
    expect(mocks.createCost).not.toHaveBeenCalled();
    await expect(reviewOrSaveCostAction(initial, form({ step: "save", amount: "250" }, ["b"]))).rejects.toThrow(LIST);
    expect(mocks.createCost).toHaveBeenLastCalledWith("trip-1", "u1", COST_ID, expect.objectContaining({ amount: 25000, shares: [{ spotId: "b", amount: 25000, originalAmount: null }] }), "keep");
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

describe("people who left (SQ-006)", () => {
  const left = { id: "u3", spotId: "l", name: "Lou Tan", image: null, isGuest: false, hasLeft: true };
  const costForm = (mode: "new" | "edit", step: string, sharedBy: string[]) =>
    formWith(
      { ...good, tripId: "trip-1", costId: COST_ID, mode, step, updatedAt: OPENED },
      sharedBy,
    );

  it("asks for the people without a cost id on a new cost, so nobody who left is offered", async () => {
    await reviewOrSaveCostAction(initial, costForm("new", "review", ["a", "b"]));
    expect(mocks.listCostPeople).toHaveBeenCalledWith("trip-1", "u1", null);
  });

  it("refuses a person who left on a new cost, because they are not in the list", async () => {
    const state = await reviewOrSaveCostAction(initial, costForm("new", "review", ["a", "l"]));
    expect(state.errors.sharedBy).toBeTruthy();
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("asks for the people with the cost id on an edit, and keeps a person who left in that cost", async () => {
    mocks.listCostPeople.mockResolvedValue([...members, left]);
    mocks.getCostForMember.mockResolvedValue({
      ...saved,
      shares: [...saved.shares, { spotId: "l", amount: 0 }],
    });
    const state = await reviewOrSaveCostAction(initial, costForm("edit", "review", ["a", "b", "l"]));
    expect(mocks.listCostPeople).toHaveBeenCalledWith("trip-1", "u1", COST_ID);
    expect(state.errors).toEqual({});
    expect(state.review?.shares.map((share) => share.spotId)).toContain("l");
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
    await expect(reviewOrSaveCostAction(initial, form({ step: "save", amount: "3500" }))).rejects.toThrow(BREAKDOWN);
    expect(mocks.updateCost).toHaveBeenCalledWith(
      "trip-1",
      COST_ID,
      "u1",
      expect.objectContaining({ amount: 350000 }),
      new Date(OPENED),
      "keep",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/trip-1/costs/${COST_ID}`);
  });

  it("returns to the cost's page after saving an edit, not the list", async () => {
    await expect(reviewOrSaveCostAction(initial, form({ step: "save" }))).rejects.toThrow(BREAKDOWN);
    expect(mocks.redirect).toHaveBeenCalledWith(`/trips/trip-1/costs/${COST_ID}`);
    expect(mocks.redirect).not.toHaveBeenCalledWith("/trips/trip-1/costs");
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
      split: "items",
      own: expect.any(Object),
      currency: "",
      fx: "rate",
      rate: "",
      charged: "",
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

describe("restoreCostAction", () => {
  const form = (extra: Record<string, string> = {}) =>
    formWith({ tripId: "trip-1", costId: COST_ID, ...extra }, []);

  it("restores nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(restoreCostAction({}, form())).rejects.toThrow("redirect:/");
    expect(mocks.restoreCost).not.toHaveBeenCalled();
  });

  it("goes back without restoring when an id is missing", async () => {
    await expect(restoreCostAction({}, formWith({ costId: COST_ID }, []))).rejects.toThrow("redirect:/trips");
    await expect(restoreCostAction({}, formWith({ tripId: "trip-1" }, []))).rejects.toThrow(LIST);
    expect(mocks.restoreCost).not.toHaveBeenCalled();
  });

  it("restores as the signed-in person, ignoring extra fields, and goes to the Costs tab", async () => {
    await expect(restoreCostAction({}, form({ userId: "u2" }))).rejects.toThrow(LIST);
    expect(mocks.restoreCost).toHaveBeenCalledWith("trip-1", COST_ID, "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
  });

  it("ends in the same place when nothing was restored", async () => {
    mocks.restoreCost.mockResolvedValue(false);
    await expect(restoreCostAction({}, form())).rejects.toThrow(LIST);
  });

  it("shows a plain message when the restore throws", async () => {
    mocks.restoreCost.mockRejectedValue(new Error("database down"));
    await expect(restoreCostAction({}, form())).resolves.toEqual({
      error: "Couldn't restore the cost. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

// The receipt photo (SQ-035): checked at Review, uploaded only at Save, and no file is left
// behind when a save is refused, repeated or fails.
describe("receipt photo on Log a cost and Edit cost", () => {
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "image.jpg", { type: "image/jpeg" });
  const newForm = (extra: Record<string, string | File> = {}) => {
    const data = formWith({ ...good, tripId: "trip-1", costId: COST_ID, mode: "new", step: "review" });
    for (const [key, value] of Object.entries(extra)) data.set(key, value);
    return data;
  };
  const editForm = (extra: Record<string, string | File> = {}) =>
    newForm({ mode: "edit", updatedAt: OPENED, ...extra });

  it("checks a picked photo at Review but never uploads, and says the new cost has one", async () => {
    const state = await reviewOrSaveCostAction(initial, newForm({ photoAction: "replace", photo: jpeg() }));
    expect(state.review?.withPhoto).toBe(true);
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.createCost).not.toHaveBeenCalled();
    const edit = await reviewOrSaveCostAction(initial, editForm({ photoAction: "replace", photo: jpeg() }));
    expect(edit.review?.changes).toEqual([{ field: "photo", before: "None", after: "Added" }]);
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a JPEG at Review and at Save, uploading nothing", async () => {
    const text = new File(["hello"], "image.jpg", { type: "image/jpeg" });
    for (const step of ["review", "save"]) {
      const state = await reviewOrSaveCostAction(initial, newForm({ step, photoAction: "replace", photo: text }));
      expect(state.errors.form).toBe("That isn't a JPEG image. Choose another.");
      expect(state.review).toBeNull();
    }
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("uploads at Save and saves a new cost with the new file", async () => {
    await expect(reviewOrSaveCostAction(initial, newForm({ step: "save", photoAction: "replace", photo: jpeg() }))).rejects.toThrow(LIST);
    expect(mocks.putImage).toHaveBeenCalledWith("cost-photos", expect.any(Uint8Array));
    expect(mocks.createCost).toHaveBeenCalledWith("trip-1", "u1", COST_ID, expect.anything(), { set: "cost-photos/new.jpg" });
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("never reads a photo path from the form", async () => {
    await expect(
      reviewOrSaveCostAction(initial, newForm({ step: "save", photoPath: "cost-photos/evil.jpg", photoAction: "keep" })),
    ).rejects.toThrow(LIST);
    expect(mocks.createCost).toHaveBeenCalledWith("trip-1", "u1", COST_ID, expect.anything(), "keep");
  });

  it("deletes the new file when a new cost is a repeat, is refused, or fails", async () => {
    mocks.createCost.mockResolvedValue("repeat");
    await expect(reviewOrSaveCostAction(initial, newForm({ step: "save", photoAction: "replace", photo: jpeg() }))).rejects.toThrow(LIST);
    expect(mocks.deleteImages).toHaveBeenLastCalledWith(["cost-photos/new.jpg"]);
    mocks.createCost.mockResolvedValue("not-found");
    await expect(reviewOrSaveCostAction(initial, newForm({ step: "save", photoAction: "replace", photo: jpeg() }))).rejects.toThrow(LIST);
    expect(mocks.deleteImages).toHaveBeenCalledTimes(2);
    mocks.createCost.mockRejectedValue(new Error("database down"));
    const failed = await reviewOrSaveCostAction(initial, newForm({ step: "save", photoAction: "replace", photo: jpeg() }));
    expect(failed.errors.form).toBe("Couldn't save the cost. Please try again.");
    expect(mocks.deleteImages).toHaveBeenCalledTimes(3);
  });

  it("shows an upload failure without saving anything", async () => {
    mocks.putImage.mockRejectedValue(new Error("blob down"));
    const state = await reviewOrSaveCostAction(initial, newForm({ step: "save", photoAction: "replace", photo: jpeg() }));
    expect(state.errors.form).toBe("Couldn't upload that image. Please try again.");
    expect(mocks.createCost).not.toHaveBeenCalled();
  });

  it("on an edit, a replace deletes the old file and lands on the cost page", async () => {
    mocks.updateCost.mockResolvedValue({ ok: true, oldPhoto: "cost-photos/old.jpg" });
    await expect(reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "replace", photo: jpeg() }))).rejects.toThrow(BREAKDOWN);
    expect(mocks.updateCost).toHaveBeenCalledWith("trip-1", COST_ID, "u1", expect.anything(), new Date(OPENED), { set: "cost-photos/new.jpg" });
    expect(mocks.deleteImages).toHaveBeenCalledWith(["cost-photos/old.jpg"]);
  });

  it("on an edit, a remove deletes the old file and a keep deletes nothing", async () => {
    mocks.updateCost.mockResolvedValue({ ok: true, oldPhoto: "cost-photos/old.jpg" });
    await expect(reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "remove" }))).rejects.toThrow(BREAKDOWN);
    expect(mocks.updateCost).toHaveBeenLastCalledWith("trip-1", COST_ID, "u1", expect.anything(), new Date(OPENED), "remove");
    expect(mocks.deleteImages).toHaveBeenCalledWith(["cost-photos/old.jpg"]);
    mocks.deleteImages.mockClear();
    await expect(reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "keep" }))).rejects.toThrow(BREAKDOWN);
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("on an edit, deletes the new file when the cost changed since, or is gone, or the save fails", async () => {
    mocks.updateCost.mockResolvedValue("changed");
    const state = await reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "replace", photo: jpeg() }));
    expect(state.notice).toBe("Someone just changed this cost. Check it again.");
    expect(mocks.deleteImages).toHaveBeenLastCalledWith(["cost-photos/new.jpg"]);
    mocks.updateCost.mockResolvedValue("not-found");
    await expect(reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "replace", photo: jpeg() }))).rejects.toThrow(LIST);
    expect(mocks.deleteImages).toHaveBeenCalledTimes(2);
    mocks.updateCost.mockRejectedValue(new Error("database down"));
    const failed = await reviewOrSaveCostAction(initial, editForm({ step: "save", photoAction: "replace", photo: jpeg() }));
    expect(failed.errors.form).toBe("Couldn't save the cost. Please try again.");
    expect(mocks.deleteImages).toHaveBeenCalledTimes(3);
  });

  it("shows Changed and Removed at the review of an edit", async () => {
    mocks.getCostForMember.mockResolvedValue({ ...saved, hasPhoto: true });
    const changed = await reviewOrSaveCostAction(initial, editForm({ photoAction: "replace", photo: jpeg() }));
    expect(changed.review?.changes).toEqual([{ field: "photo", before: "Photo", after: "Changed" }]);
    const removed = await reviewOrSaveCostAction(initial, editForm({ photoAction: "remove" }));
    expect(removed.review?.changes).toEqual([{ field: "photo", before: "Photo", after: "Removed" }]);
  });
});

describe("addCostPhotoAction (the Cost page box)", () => {
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], "image.jpg", { type: "image/jpeg" });
  const photoForm = (file: File | null = jpeg(), fields: Record<string, string> = { tripId: "trip-1", costId: COST_ID }) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    if (file) data.set("photo", file);
    return data;
  };
  const FAILED = "Couldn't add the photo. Try again with a smaller picture or better signal.";

  it("does nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(addCostPhotoAction({}, photoForm())).rejects.toThrow("redirect:/");
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("stores the file, puts it on the cost as the signed-in person, and refreshes the cost's pages", async () => {
    await expect(addCostPhotoAction({}, photoForm())).resolves.toEqual({});
    expect(mocks.putImage).toHaveBeenCalledWith("cost-photos", expect.any(Uint8Array));
    expect(mocks.setCostPhotoForMember).toHaveBeenCalledWith("trip-1", COST_ID, "u1", "cost-photos/new.jpg");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/trip-1/costs/${COST_ID}`);
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("deletes the file it replaced", async () => {
    mocks.setCostPhotoForMember.mockResolvedValue({ ok: true, old: "cost-photos/old.jpg" });
    await addCostPhotoAction({}, photoForm());
    expect(mocks.deleteImages).toHaveBeenCalledWith(["cost-photos/old.jpg"]);
  });

  it("refuses a missing file or one that is not a JPEG, uploading nothing", async () => {
    await expect(addCostPhotoAction({}, photoForm(null))).resolves.toEqual({ error: FAILED });
    const text = new File(["hello"], "image.jpg", { type: "image/jpeg" });
    await expect(addCostPhotoAction({}, photoForm(text))).resolves.toEqual({ error: FAILED });
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("deletes the new file when the save is refused or fails, and when the upload fails says so", async () => {
    mocks.setCostPhotoForMember.mockResolvedValue({ ok: false });
    await expect(addCostPhotoAction({}, photoForm())).resolves.toEqual({ error: FAILED });
    expect(mocks.deleteImages).toHaveBeenLastCalledWith(["cost-photos/new.jpg"]);
    mocks.setCostPhotoForMember.mockRejectedValue(new Error("database down"));
    await expect(addCostPhotoAction({}, photoForm())).resolves.toEqual({ error: FAILED });
    expect(mocks.deleteImages).toHaveBeenCalledTimes(2);
    mocks.putImage.mockRejectedValue(new Error("blob down"));
    await expect(addCostPhotoAction({}, photoForm())).resolves.toEqual({ error: FAILED });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores any path in the form and goes back when an id is missing", async () => {
    await addCostPhotoAction({}, photoForm(jpeg(), { tripId: "trip-1", costId: COST_ID, photoPath: "cost-photos/evil.jpg" }));
    expect(mocks.setCostPhotoForMember).toHaveBeenCalledWith("trip-1", COST_ID, "u1", "cost-photos/new.jpg");
    await expect(addCostPhotoAction({}, photoForm(jpeg(), { costId: COST_ID }))).rejects.toThrow("redirect:/trips");
    await expect(addCostPhotoAction({}, photoForm(jpeg(), { tripId: "trip-1" }))).rejects.toThrow(LIST);
  });
});
