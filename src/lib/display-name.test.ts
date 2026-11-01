import { describe, expect, it } from "vitest";
import { validateDisplayName } from "./display-name";

describe("validateDisplayName", () => {
  it("trims surrounding spaces", () => {
    expect(validateDisplayName("  Maya Cruz  ")).toEqual({ ok: true, name: "Maya Cruz" });
  });

  it("collapses inner whitespace", () => {
    expect(validateDisplayName("Maya   \t Cruz")).toEqual({ ok: true, name: "Maya Cruz" });
  });

  it("rejects an empty string", () => {
    expect(validateDisplayName("")).toEqual({ ok: false, error: "Please enter a name." });
  });

  it("rejects whitespace only", () => {
    expect(validateDisplayName("   \n ")).toEqual({ ok: false, error: "Please enter a name." });
  });

  it("accepts exactly 40 characters and rejects 41", () => {
    expect(validateDisplayName("a".repeat(40)).ok).toBe(true);
    expect(validateDisplayName("a".repeat(41))).toEqual({
      ok: false,
      error: "Keep it to 40 characters or fewer.",
    });
  });

  it("accepts accented names", () => {
    expect(validateDisplayName("Nguyễn")).toEqual({ ok: true, name: "Nguyễn" });
  });

  it("counts each emoji as one character", () => {
    expect(validateDisplayName("😀".repeat(40)).ok).toBe(true);
    expect(validateDisplayName("😀".repeat(41)).ok).toBe(false);
  });

  it("rejects non-string input", () => {
    for (const bad of [null, undefined, 42, {}, ["Maya"]]) {
      expect(validateDisplayName(bad)).toEqual({ ok: false, error: "Please enter a name." });
    }
  });
});
