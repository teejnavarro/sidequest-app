import { describe, expect, it } from "vitest";
import { FACE_COUNT, faceColorClass, faceColorIndex, initialsOf } from "./face-color";

describe("faceColorIndex", () => {
  it("gives the same color for the same person every time", () => {
    expect(faceColorIndex("user-abc")).toBe(faceColorIndex("user-abc"));
  });

  it("always lands on one of the four colors", () => {
    for (const id of ["", "a", "user-abc", "ñandú", "😀", "x".repeat(200)]) {
      const index = faceColorIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(FACE_COUNT);
      expect(faceColorClass(id)).toMatch(/^bg-face-[1-4]$/);
    }
  });

  it("uses more than one color across different people", () => {
    const used = new Set(Array.from({ length: 30 }, (_, i) => faceColorIndex(`user-${i}`)));
    expect(used.size).toBeGreaterThan(1);
  });
});

describe("initialsOf", () => {
  it("takes up to two letters", () => {
    expect(initialsOf("Maya Cruz")).toBe("MC");
    expect(initialsOf("  maya  ")).toBe("M");
    expect(initialsOf("Ana Maria Lopez")).toBe("AM");
  });

  it("keeps accented and emoji first letters whole", () => {
    expect(initialsOf("Ðạt Nguyễn")).toBe("ÐN");
    expect(initialsOf("😀 Fun")).toBe("😀F");
  });

  it("falls back to a question mark", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});
