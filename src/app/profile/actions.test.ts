import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateDisplayName } from "./actions";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ auth: { api: { updateUser: mocks.updateUser } } }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));

const initial = { ok: false, message: "" };

function formWith(name?: string) {
  const form = new FormData();
  if (name !== undefined) form.set("name", name);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.updateUser.mockResolvedValue({ status: true });
});

describe("updateDisplayName", () => {
  it("saves nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(updateDisplayName(initial, formWith("Maya Cruz"))).rejects.toThrow("redirect:/");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("saves the cleaned-up name and refreshes the profile", async () => {
    const result = await updateDisplayName(initial, formWith("  Maya   Cruz "));
    expect(result).toEqual({ ok: true, message: "Saved." });
    expect(mocks.updateUser.mock.calls[0][0].body).toEqual({ name: "Maya Cruz" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("only ever sends the name, even if the form carries more", async () => {
    const form = formWith("Maya Cruz");
    form.set("image", "https://example.test/photo.png");
    form.set("email", "other@example.test");
    await updateDisplayName(initial, form);
    expect(mocks.updateUser.mock.calls[0][0].body).toEqual({ name: "Maya Cruz" });
  });

  it.each([
    ["empty", "", "Please enter a name."],
    ["missing", undefined, "Please enter a name."],
    ["invisible", "​", "Please enter a name."],
    ["too long", "a".repeat(41), "Keep it to 40 characters or fewer."],
  ])("rejects a %s name without saving", async (_label, name, message) => {
    await expect(updateDisplayName(initial, formWith(name))).resolves.toEqual({ ok: false, message });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a plain message when the save fails", async () => {
    mocks.updateUser.mockRejectedValue(new Error("database down"));
    await expect(updateDisplayName(initial, formWith("Maya Cruz"))).resolves.toEqual({
      ok: false,
      message: "Could not save your name. Please try again.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
