import { describe, expect, it } from "vitest";
import {
  DURATIONS,
  IDEA_TYPES,
  durationLabel,
  formatCost,
  ideaTypeOf,
  isDuration,
  isIdeaType,
  linkLabel,
} from "./idea-options";

describe("idea types and durations", () => {
  it("lists the seven types in order, each with an icon", () => {
    expect(IDEA_TYPES.map((t) => t.value)).toEqual([
      "food", "sightseeing", "adventure", "experience", "shopping", "nightlife", "other",
    ]);
    for (const type of IDEA_TYPES) expect(type.icon).toMatch(/^[A-Z][A-Za-z]+$/);
  });

  it("lists the three durations", () => {
    expect(DURATIONS.map((d) => [d.value, d.label])).toEqual([
      ["short", "1–2 hrs"],
      ["half", "Half day"],
      ["full", "Full day"],
    ]);
  });

  it("knows which values are real", () => {
    expect(isIdeaType("food")).toBe(true);
    expect(isIdeaType("Food")).toBe(false);
    expect(isIdeaType("")).toBe(false);
    expect(isDuration("half")).toBe(true);
    expect(isDuration("long")).toBe(false);
  });

  it("falls back to Other for an unknown type and shows durations by name", () => {
    expect(ideaTypeOf("food").label).toBe("Food");
    expect(ideaTypeOf("mystery").value).toBe("other");
    expect(durationLabel("full")).toBe("Full day");
  });
});

describe("formatCost", () => {
  it("shows whole amounts with the currency's short symbol", () => {
    expect(formatCost(120, "PHP")).toBe("₱120");
    expect(formatCost(1200, "PHP")).toBe("₱1,200");
    expect(formatCost(0, "PHP")).toBe("₱0");
    expect(formatCost(50000, "VND")).toBe("₫50,000");
  });

  it("falls back to the code for a currency it can't format", () => {
    expect(formatCost(120, "NOPE!")).toBe("120 NOPE!");
  });
});

describe("linkLabel", () => {
  it.each([
    "https://maps.app.goo.gl/abc123",
    "https://goo.gl/maps/abc123",
    "https://maps.google.com/?q=cho+ben+thanh",
    "https://maps.google.com.ph/maps?q=x",
    "https://www.google.com/maps/place/Ch%E1%BB%A3+B%E1%BA%BFn+Th%C3%A0nh",
    "https://google.com/maps/@10.77,106.69,15z",
    "https://www.google.com.vn/maps/place/x",
    "HTTPS://MAPS.APP.GOO.GL/ABC",
  ])("calls %s a Google Maps link", (url) => {
    expect(linkLabel(url)).toBe("Open in Google Maps");
  });

  it.each([
    "https://example.com/maps",
    "https://www.google.com/search?q=maps",
    "https://goo.gl/abc",
    "https://maps.google.evil.example/",
    "https://notgoogle.com/maps",
    "https://google.com.evil.example/maps",
    "https://www.tripadvisor.com/Restaurant",
    "not a link",
    "",
  ])("calls %j just a link", (url) => {
    expect(linkLabel(url)).toBe("Open link");
  });
});

describe("currencySymbol", () => {
  it("gives the short symbol, or the code when there is none", async () => {
    const { currencySymbol } = await import("./idea-options");
    expect(currencySymbol("PHP")).toBe("₱");
    expect(currencySymbol("VND")).toBe("₫");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("AED")).toBe("AED");
    expect(currencySymbol("NOPE!")).toBe("NOPE!");
  });
});
