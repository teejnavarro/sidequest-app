import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, getOptionalUser } from "./current-user";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));

const session = {
  session: { id: "s1", token: "made-up-token" },
  user: {
    id: "u1",
    name: "Maya Cruz",
    image: "https://lh3.googleusercontent.com/a/made-up",
    email: "maya@example.test",
    emailVerified: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOptionalUser", () => {
  it("returns null when signed out", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getOptionalUser()).resolves.toBeNull();
  });

  it("returns only id, name and image, never email or tokens", async () => {
    mocks.getSession.mockResolvedValue(session);
    await expect(getOptionalUser()).resolves.toEqual({
      id: "u1",
      name: "Maya Cruz",
      image: "https://lh3.googleusercontent.com/a/made-up",
    });
  });

  it("turns a missing photo into null", async () => {
    mocks.getSession.mockResolvedValue({ ...session, user: { ...session.user, image: undefined } });
    await expect(getOptionalUser()).resolves.toMatchObject({ image: null });
  });
});

describe("getCurrentUser", () => {
  it("sends signed-out visitors home", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(getCurrentUser()).rejects.toThrow("redirect:/");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });

  it("returns the user when signed in", async () => {
    mocks.getSession.mockResolvedValue(session);
    await expect(getCurrentUser()).resolves.toMatchObject({ id: "u1", name: "Maya Cruz" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
