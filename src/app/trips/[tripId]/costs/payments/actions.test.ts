import { beforeEach, describe, expect, it, vi } from "vitest";
import { deletePaymentAction, recordPaymentAction } from "./actions";
import { emptyPayValues } from "@/lib/payment-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPayPageForMember: vi.fn(),
  recordPayment: vi.fn(),
  deletePayment: vi.fn(),
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
vi.mock("@/lib/blob-store", () => ({ putImage: mocks.putImage, deleteImages: mocks.deleteImages }));
vi.mock("@/lib/payments", () => ({
  getPayPageForMember: mocks.getPayPageForMember,
  recordPayment: mocks.recordPayment,
  deletePayment: mocks.deletePayment,
}));

const initial = { errors: {}, values: emptyPayValues };
const BALANCES = "redirect:/trips/trip-1/costs/balances";
const PAYMENT_ID = "7d0c2c0e-6f1a-4d1e-9a58-3f6c9b1a2d44";
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], "r.jpg", { type: "image/jpeg" });

const page = {
  currency: "PHP",
  from: { spotId: "a", name: "Ben", isGuest: false, hasLeft: false, isYou: true },
  to: { spotId: "b", name: "Ana", isGuest: false, hasLeft: false, isYou: false },
  amount: 90000, // the line right now: 900.00
  canRecord: true,
  receiver: { reason: "none" },
};

function formWith(fields: Record<string, string | File> = {}) {
  const form = new FormData();
  const base = { tripId: "trip-1", paymentId: PAYMENT_ID, fromSpot: "a", toSpot: "b", amount: "900", method: "gcash" };
  for (const [key, value] of Object.entries({ ...base, ...fields })) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben", image: null });
  mocks.getPayPageForMember.mockResolvedValue(page);
  mocks.recordPayment.mockResolvedValue("ok");
  mocks.deletePayment.mockResolvedValue({ receiptPath: null });
  mocks.putImage.mockResolvedValue("receipts/new.jpg");
  mocks.deleteImages.mockResolvedValue(undefined);
});

describe("recordPaymentAction", () => {
  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(recordPaymentAction(initial, formWith())).rejects.toThrow("redirect:/");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("records the payment with the checked amount, then refreshes and goes to Balances", async () => {
    await expect(recordPaymentAction(initial, formWith({ amount: "450.50", method: "cash" }))).rejects.toThrow(BALANCES);
    expect(mocks.getPayPageForMember).toHaveBeenCalledWith("trip-1", "a", "b", "u1");
    expect(mocks.recordPayment).toHaveBeenCalledWith({
      tripId: "trip-1",
      paymentId: PAYMENT_ID,
      fromSpot: "a",
      toSpot: "b",
      amount: 45050,
      method: "cash",
      receiptPath: null,
      userId: "u1",
    });
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs/balances");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("refuses an amount above the fresh line with the spec wording, saving nothing", async () => {
    const result = await recordPaymentAction(initial, formWith({ amount: "900.01" }));
    expect(result.errors.amount).toBe("That's more than you owe Ana (₱900.00). Lower the amount.");
    expect(result.values.amount).toBe("900.01");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("says you when the receiver is the viewer, and names both for a third person", async () => {
    mocks.getPayPageForMember.mockResolvedValue({
      ...page,
      amount: 45000,
      from: { ...page.from, name: "Bea", isYou: false },
      to: { ...page.to, name: "Ben", isYou: true },
    });
    const receiver = await recordPaymentAction(initial, formWith({ amount: "450.01" }));
    expect(receiver.errors.amount).toBe("That's more than Bea owes you (₱450.00). Lower the amount.");
    mocks.getPayPageForMember.mockResolvedValue({
      ...page,
      amount: 45000,
      from: { ...page.from, name: "Bea", isYou: false },
      to: { ...page.to, isYou: false },
      canRecord: true,
    });
    const third = await recordPaymentAction(initial, formWith({ amount: "450.01" }));
    expect(third.errors.amount).toBe("That's more than Bea owes Ana (₱450.00). Lower the amount.");
  });

  it("refuses a bad method or a blank amount", async () => {
    const result = await recordPaymentAction(initial, formWith({ amount: "", method: "paypal" }));
    expect(result.errors).toEqual({ amount: "Enter an amount.", method: "Choose how it was paid." });
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("sends a person who is not a party, or a line that is gone, back to Balances", async () => {
    mocks.getPayPageForMember.mockResolvedValue({ ...page, canRecord: false });
    await expect(recordPaymentAction(initial, formWith())).rejects.toThrow(BALANCES);
    mocks.getPayPageForMember.mockResolvedValue(null);
    await expect(recordPaymentAction(initial, formWith({ receipt: jpeg() }))).rejects.toThrow(BALANCES);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("goes to Balances when the payment id is not a UUID", async () => {
    await expect(recordPaymentAction(initial, formWith({ paymentId: "not-a-uuid" }))).rejects.toThrow(BALANCES);
    expect(mocks.getPayPageForMember).not.toHaveBeenCalled();
  });

  it("uploads the receipt first and stores its path", async () => {
    await expect(recordPaymentAction(initial, formWith({ receipt: jpeg() }))).rejects.toThrow(BALANCES);
    expect(mocks.putImage).toHaveBeenCalledWith("receipts", expect.any(Uint8Array));
    expect(mocks.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ receiptPath: "receipts/new.jpg" }));
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("refuses a receipt that is not a JPEG and uploads nothing", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "r.png", { type: "image/png" });
    const result = await recordPaymentAction(initial, formWith({ receipt: png }));
    expect(result.errors.receipt).toBeTruthy();
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("deletes the uploaded receipt on a repeat, and still ends on Balances", async () => {
    mocks.recordPayment.mockResolvedValue("repeat");
    await expect(recordPaymentAction(initial, formWith({ receipt: jpeg() }))).rejects.toThrow(BALANCES);
    expect(mocks.deleteImages).toHaveBeenCalledWith(["receipts/new.jpg"]);
  });

  it("deletes the uploaded receipt when the payment is not allowed", async () => {
    mocks.recordPayment.mockResolvedValue("not-allowed");
    await expect(recordPaymentAction(initial, formWith({ receipt: jpeg() }))).rejects.toThrow(BALANCES);
    expect(mocks.deleteImages).toHaveBeenCalledWith(["receipts/new.jpg"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the uploaded receipt when saving throws, and stays on the form", async () => {
    mocks.recordPayment.mockRejectedValue(new Error("db down"));
    const result = await recordPaymentAction(initial, formWith({ receipt: jpeg() }));
    expect(result.errors.form).toBeTruthy();
    expect(mocks.deleteImages).toHaveBeenCalledWith(["receipts/new.jpg"]);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("ignores a cap or a payer sent in the form", async () => {
    const form = formWith({ amount: "1000", maxAmount: "999999", createdBy: "someone" });
    const result = await recordPaymentAction(initial, form);
    expect(result.errors.amount).toContain("more than");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });
});

describe("deletePaymentAction", () => {
  it("deletes the payment, then its receipt file, then goes to Balances", async () => {
    mocks.deletePayment.mockResolvedValue({ receiptPath: "receipts/old.jpg" });
    await expect(deletePaymentAction({}, formWith())).rejects.toThrow(BALANCES);
    expect(mocks.deletePayment).toHaveBeenCalledWith("trip-1", PAYMENT_ID, "u1");
    expect(mocks.deleteImages).toHaveBeenCalledWith(["receipts/old.jpg"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips/trip-1/costs/balances");
  });

  it("deletes no file when it was not the person's payment", async () => {
    mocks.deletePayment.mockResolvedValue("not-found");
    await expect(deletePaymentAction({}, formWith())).rejects.toThrow(BALANCES);
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("says so when the delete fails, and removes no file", async () => {
    mocks.deletePayment.mockRejectedValue(new Error("db down"));
    const result = await deletePaymentAction({}, formWith());
    expect(result.error).toBeTruthy();
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(deletePaymentAction({}, formWith())).rejects.toThrow("redirect:/");
    expect(mocks.deletePayment).not.toHaveBeenCalled();
  });
});
