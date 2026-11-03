import { beforeEach, describe, expect, it, vi } from "vitest";
import { joinTripAction, signInToJoin } from "./actions";

const mocks = vi.hoisted(() => ({
  getOptionalUser: vi.fn(),
  joinTripByInviteCode: vi.fn(),
  signInSocial: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInSocial: mocks.signInSocial } } }));
vi.mock("@/lib/current-user", () => ({ getOptionalUser: mocks.getOptionalUser }));
vi.mock("@/lib/trips", () => ({ joinTripByInviteCode: mocks.joinTripByInviteCode }));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";
const initial = { message: "" };

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
  mocks.getOptionalUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.joinTripByInviteCode.mockResolvedValue("trip-1");
  mocks.signInSocial.mockResolvedValue({ url: "https://accounts.example.test/sign-in" });
});

describe("joinTripAction", () => {
  it("saves nothing when signed out and sends the visitor back to the invite page", async () => {
    mocks.getOptionalUser.mockResolvedValue(null);
    await expect(joinTripAction(initial, formWith({ code: CODE }))).rejects.toThrow(
      `redirect:/join/${CODE}`,
    );
    expect(mocks.joinTripByInviteCode).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["empty", { code: "" }],
    ["wrong shape", { code: "not-a-code" }],
    ["a web address", { code: "https://example.test/evil" }],
  ])("saves nothing for a %s code", async (_label, fields) => {
    await expect(joinTripAction(initial, formWith(fields))).rejects.toThrow("redirect:/");
    expect(mocks.joinTripByInviteCode).not.toHaveBeenCalled();
  });

  it("joins as the signed-in person and goes to the trip", async () => {
    await expect(joinTripAction(initial, formWith({ code: CODE }))).rejects.toThrow(
      "redirect:/trips/trip-1",
    );
    expect(mocks.joinTripByInviteCode).toHaveBeenCalledWith(CODE, "u1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("ignores extra fields such as userId and callbackURL", async () => {
    const form = formWith({ code: CODE, userId: "someone-else", callbackURL: "https://evil.test" });
    await expect(joinTripAction(initial, form)).rejects.toThrow("redirect:/trips/trip-1");
    expect(mocks.joinTripByInviteCode).toHaveBeenCalledWith(CODE, "u1");
  });

  it("says the link isn't working when the code opens no trip", async () => {
    mocks.joinTripByInviteCode.mockResolvedValue(null);
    await expect(joinTripAction(initial, formWith({ code: CODE }))).resolves.toEqual({
      message: "This invite link isn't working.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a plain message when the save fails", async () => {
    mocks.joinTripByInviteCode.mockRejectedValue(new Error("database down"));
    await expect(joinTripAction(initial, formWith({ code: CODE }))).resolves.toEqual({
      message: "Could not join the trip. Please try again.",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("signInToJoin", () => {
  it("returns to the invite page, built from the checked code", async () => {
    await expect(signInToJoin(formWith({ code: CODE.toUpperCase() }))).rejects.toThrow(
      "redirect:https://accounts.example.test/sign-in",
    );
    expect(mocks.signInSocial.mock.calls[0][0].body).toEqual({
      provider: "google",
      callbackURL: `/join/${CODE}`,
    });
  });

  it("never takes a return address from the form", async () => {
    const form = formWith({ code: CODE, callbackURL: "https://evil.test", redirectTo: "/trips" });
    await expect(signInToJoin(form)).rejects.toThrow("redirect:https://accounts");
    expect(mocks.signInSocial.mock.calls[0][0].body.callbackURL).toBe(`/join/${CODE}`);
  });

  it.each([
    ["missing", {}],
    ["wrong shape", { code: "../../trips" }],
    ["a web address", { code: "https://evil.test" }],
  ])("starts no sign-in for a %s code", async (_label, fields) => {
    await expect(signInToJoin(formWith(fields))).rejects.toThrow("redirect:/");
    expect(mocks.signInSocial).not.toHaveBeenCalled();
  });

  it("goes home when Google gives no address", async () => {
    mocks.signInSocial.mockResolvedValue({});
    await expect(signInToJoin(formWith({ code: CODE }))).rejects.toThrow("redirect:/");
  });
});
