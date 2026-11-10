import { describe, expect, it } from "vitest";
import { validateGuestName } from "./guest-input";

describe("validateGuestName", () => {
  it("trims and collapses spaces, and keeps accents", () => {
    expect(validateGuestName("  Lía   Reyes ")).toEqual({ ok: true, name: "Lía Reyes" });
  });

  it("refuses blank, blank-looking and non-text input", () => {
    for (const raw of ["", "   ", "​⠀", undefined, 12, null]) {
      expect(validateGuestName(raw)).toEqual({ ok: false, error: "Please enter a name." });
    }
  });

  it("allows 40 characters and refuses 41", () => {
    expect(validateGuestName("a".repeat(40)).ok).toBe(true);
    expect(validateGuestName("a".repeat(41))).toEqual({
      ok: false,
      error: "Keep it to 40 characters or fewer.",
    });
  });
});
