import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountAction } from "./actions";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signOut: mocks.signOut } } }));
vi.mock("@/lib/account", () => ({ deleteAccount: mocks.deleteAccount }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));

const run = () => deleteAccountAction();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.deleteAccount.mockResolvedValue("ok");
  mocks.signOut.mockResolvedValue({ success: true });
});

describe("deleteAccountAction", () => {
  it("deletes nothing when signed out", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run()).rejects.toThrow("redirect:/");
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the signed-in person's account, clears the cookie and goes to the sign-in page", async () => {
    await expect(run()).rejects.toThrow("redirect:/?deleted=1");
    expect(mocks.deleteAccount).toHaveBeenCalledWith("u1");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("sends the person back to the hand-over list when a shared trip is still theirs", async () => {
    mocks.deleteAccount.mockResolvedValue("owns-shared-trips");
    await expect(run()).rejects.toThrow("redirect:/profile/delete");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("still ends on the sign-in page when clearing the cookie fails", async () => {
    mocks.signOut.mockRejectedValue(new Error("no session"));
    await expect(run()).rejects.toThrow("redirect:/?deleted=1");
  });
});
