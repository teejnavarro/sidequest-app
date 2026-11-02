import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle, signOut } from "./actions";

const mocks = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { signInSocial: mocks.signInSocial, signOut: mocks.signOut } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signInWithGoogle", () => {
  it("asks for Google, returns to My trips and sends the visitor to Google", async () => {
    mocks.signInSocial.mockResolvedValue({ url: "https://accounts.example.test/choose" });
    await expect(signInWithGoogle()).rejects.toThrow("redirect:https://accounts.example.test/choose");
    expect(mocks.signInSocial.mock.calls[0][0].body).toEqual({ provider: "google", callbackURL: "/trips" });
  });

  it("goes home when no Google address comes back", async () => {
    mocks.signInSocial.mockResolvedValue({ url: undefined });
    await expect(signInWithGoogle()).rejects.toThrow("redirect:/");
  });
});

describe("signOut", () => {
  it("ends the session, then goes home", async () => {
    mocks.signOut.mockResolvedValue({ success: true });
    await expect(signOut()).rejects.toThrow("redirect:/");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
