import { beforeEach, describe, expect, it, vi } from "vitest";
import { deletePaymentAccountAction, savePaymentAccountAction } from "./actions";
import { emptyAccountValues } from "@/lib/payment-form-state";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createPaymentAccount: vi.fn(),
  updatePaymentAccount: vi.fn(),
  deletePaymentAccount: vi.fn(),
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
  createPaymentAccount: mocks.createPaymentAccount,
  updatePaymentAccount: mocks.updatePaymentAccount,
  deletePaymentAccount: mocks.deletePaymentAccount,
}));

const initial = { errors: {}, values: emptyAccountValues };
const PROFILE = "redirect:/profile";
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], "qr.jpg", { type: "image/jpeg" });

function formWith(fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

const wallet = { kind: "gcash", accountName: "Maya Cruz", number: "0917 123 4567" };
const bank = { kind: "bank", bankName: "BDO", accountName: "Maya Cruz", number: "001234567890" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`redirect:${url}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.createPaymentAccount.mockResolvedValue("ok");
  mocks.updatePaymentAccount.mockResolvedValue({ oldQrPath: null });
  mocks.deletePaymentAccount.mockResolvedValue({ qrPath: null });
  mocks.putImage.mockResolvedValue("qr/new.jpg");
  mocks.deleteImages.mockResolvedValue(undefined);
});

describe("savePaymentAccountAction", () => {
  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(savePaymentAccountAction(initial, formWith(wallet))).rejects.toThrow("redirect:/");
    expect(mocks.createPaymentAccount).not.toHaveBeenCalled();
  });

  it("returns field errors and writes nothing for bad details", async () => {
    const result = await savePaymentAccountAction(initial, formWith({ ...wallet, number: "123" }));
    expect(result.errors.number).toBe("Enter an 11-digit number starting with 09.");
    expect(result.values.number).toBe("123");
    const bankResult = await savePaymentAccountAction(initial, formWith({ ...bank, bankName: "" }));
    expect(bankResult.errors.bankName).toBe("Enter the bank name.");
    expect(mocks.createPaymentAccount).not.toHaveBeenCalled();
    expect(mocks.putImage).not.toHaveBeenCalled();
  });

  it("creates an account with cleaned values and only the named fields", async () => {
    const form = formWith({ ...wallet, userId: "someone-else", qrPath: "qr/evil.jpg", email: "x@example.test" });
    await expect(savePaymentAccountAction(initial, form)).rejects.toThrow(PROFILE);
    expect(mocks.createPaymentAccount).toHaveBeenCalledWith(
      "u1",
      { kind: "gcash", accountName: "Maya Cruz", number: "09171234567" },
      null,
    );
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("uploads a new QR first, then saves the path", async () => {
    await expect(
      savePaymentAccountAction(initial, formWith({ ...wallet, qrAction: "replace", qr: jpeg() })),
    ).rejects.toThrow(PROFILE);
    expect(mocks.putImage).toHaveBeenCalledWith("qr", expect.any(Uint8Array));
    expect(mocks.createPaymentAccount).toHaveBeenCalledWith("u1", expect.anything(), "qr/new.jpg");
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("refuses a picture that is not a JPEG and uploads nothing", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "qr.png", { type: "image/png" });
    const result = await savePaymentAccountAction(initial, formWith({ ...wallet, qrAction: "replace", qr: png }));
    expect(result.errors.qr).toBeTruthy();
    expect(mocks.putImage).not.toHaveBeenCalled();
    expect(mocks.createPaymentAccount).not.toHaveBeenCalled();
  });

  it("deletes the uploaded file when the write throws", async () => {
    mocks.createPaymentAccount.mockRejectedValue(new Error("db down"));
    const result = await savePaymentAccountAction(initial, formWith({ ...wallet, qrAction: "replace", qr: jpeg() }));
    expect(result.errors.form).toBeTruthy();
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/new.jpg"]);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("deletes the uploaded file and says so when there are already 10 accounts", async () => {
    mocks.createPaymentAccount.mockResolvedValue("too-many");
    const result = await savePaymentAccountAction(initial, formWith({ ...wallet, qrAction: "replace", qr: jpeg() }));
    expect(result.errors.form).toContain("10");
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/new.jpg"]);
  });

  it("keeps the QR on edit, and deletes nothing", async () => {
    await expect(
      savePaymentAccountAction(initial, formWith({ ...wallet, accountId: "a1", qrAction: "keep" })),
    ).rejects.toThrow(PROFILE);
    expect(mocks.updatePaymentAccount).toHaveBeenCalledWith("u1", "a1", expect.anything(), { mode: "keep" });
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("replaces the QR and deletes the old file only after the write worked", async () => {
    mocks.updatePaymentAccount.mockResolvedValue({ oldQrPath: "qr/old.jpg" });
    const order: string[] = [];
    mocks.updatePaymentAccount.mockImplementation(async () => {
      order.push("write");
      return { oldQrPath: "qr/old.jpg" };
    });
    mocks.deleteImages.mockImplementation(async () => {
      order.push("delete");
    });
    await expect(
      savePaymentAccountAction(initial, formWith({ ...bank, accountId: "a1", qrAction: "replace", qr: jpeg() })),
    ).rejects.toThrow(PROFILE);
    expect(mocks.updatePaymentAccount).toHaveBeenCalledWith("u1", "a1", expect.anything(), {
      mode: "replace",
      path: "qr/new.jpg",
    });
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/old.jpg"]);
    expect(order).toEqual(["write", "delete"]);
  });

  it("removes the QR and deletes the old file afterwards", async () => {
    mocks.updatePaymentAccount.mockResolvedValue({ oldQrPath: "qr/old.jpg" });
    await expect(
      savePaymentAccountAction(initial, formWith({ ...wallet, accountId: "a1", qrAction: "remove" })),
    ).rejects.toThrow(PROFILE);
    expect(mocks.updatePaymentAccount).toHaveBeenCalledWith("u1", "a1", expect.anything(), { mode: "remove" });
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/old.jpg"]);
  });

  it("keeps the old file when the replace write fails, and deletes the new one", async () => {
    mocks.updatePaymentAccount.mockRejectedValue(new Error("db down"));
    await savePaymentAccountAction(initial, formWith({ ...wallet, accountId: "a1", qrAction: "replace", qr: jpeg() }));
    expect(mocks.deleteImages).toHaveBeenCalledTimes(1);
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/new.jpg"]);
  });

  it("deletes the new file and leaves quietly when the account is not the person's own", async () => {
    mocks.updatePaymentAccount.mockResolvedValue("not-found");
    await expect(
      savePaymentAccountAction(initial, formWith({ ...wallet, accountId: "someone-elses", qrAction: "replace", qr: jpeg() })),
    ).rejects.toThrow(PROFILE);
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/new.jpg"]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deletePaymentAccountAction", () => {
  it("deletes the account, then its QR file, then goes to the profile", async () => {
    mocks.deletePaymentAccount.mockResolvedValue({ qrPath: "qr/old.jpg" });
    await expect(deletePaymentAccountAction({}, formWith({ accountId: "a1" }))).rejects.toThrow(PROFILE);
    expect(mocks.deletePaymentAccount).toHaveBeenCalledWith("u1", "a1");
    expect(mocks.deleteImages).toHaveBeenCalledWith(["qr/old.jpg"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("deletes no file for an account that is not the person's own", async () => {
    mocks.deletePaymentAccount.mockResolvedValue("not-found");
    await expect(deletePaymentAccountAction({}, formWith({ accountId: "a9" }))).rejects.toThrow(PROFILE);
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("says so when the delete fails, and removes no file", async () => {
    mocks.deletePaymentAccount.mockRejectedValue(new Error("db down"));
    const result = await deletePaymentAccountAction({}, formWith({ accountId: "a1" }));
    expect(result.error).toBeTruthy();
    expect(mocks.deleteImages).not.toHaveBeenCalled();
  });

  it("does nothing without an id", async () => {
    await expect(deletePaymentAccountAction({}, formWith({}))).rejects.toThrow(PROFILE);
    expect(mocks.deletePaymentAccount).not.toHaveBeenCalled();
  });

  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(deletePaymentAccountAction({}, formWith({ accountId: "a1" }))).rejects.toThrow("redirect:/");
    expect(mocks.deletePaymentAccount).not.toHaveBeenCalled();
  });
});
