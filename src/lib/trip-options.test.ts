import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_TIME_ZONE,
  TIME_ZONES,
  TIME_ZONE_GROUPS,
  timeZonePlace,
} from "./trip-options";

describe("time zone list", () => {
  it("only holds zones the browser and server both understand", () => {
    for (const zone of TIME_ZONES) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: zone.value })).not.toThrow();
    }
  });

  it("lists Manila by name", () => {
    const manila = TIME_ZONES.find((zone) => zone.value === "Asia/Manila");
    expect(manila?.label).toContain("Manila");
  });

  it("has no duplicate labels or values", () => {
    expect(new Set(TIME_ZONES.map((z) => z.label)).size).toBe(TIME_ZONES.length);
    expect(new Set(TIME_ZONES.map((z) => z.value)).size).toBe(TIME_ZONES.length);
  });

  it("puts the Philippines first", () => {
    expect(TIME_ZONES[0].value).toBe("Asia/Manila");
    expect(TIME_ZONE_GROUPS[0]).toBe("Southeast Asia");
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Manila");
  });

  it("puts every entry in a known group", () => {
    for (const zone of TIME_ZONES) {
      expect(TIME_ZONE_GROUPS).toContain(zone.group);
    }
  });

  it("names the place for 'Times are ... time'", () => {
    expect(timeZonePlace("Asia/Manila")).toBe("Philippines");
    expect(timeZonePlace("Asia/Singapore")).toBe("Singapore");
    expect(timeZonePlace("Not/AZone")).toBeNull();
  });
});

describe("currency list", () => {
  it("starts with PHP and has no duplicates", () => {
    expect(CURRENCIES[0].value).toBe("PHP");
    expect(DEFAULT_CURRENCY).toBe("PHP");
    expect(new Set(CURRENCIES.map((c) => c.value)).size).toBe(CURRENCIES.length);
  });

  it("shows each as 'CODE, name'", () => {
    for (const currency of CURRENCIES) {
      expect(currency.label.startsWith(`${currency.value}, `)).toBe(true);
    }
  });
});
