import { afterEach, describe, expect, it } from "vitest";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  DEFAULT_TIME_ZONE,
  TIME_ZONES,
  TIME_ZONE_GROUPS,
  timeZoneLabel,
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

  it("names just the place, without the cities", () => {
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

describe("timeZoneLabel for the trip header", () => {
  it("shows the offset and the place for Manila", () => {
    expect(timeZoneLabel("Asia/Manila", "2027-03-12")).toBe("GMT+8 Philippines");
  });

  it("shows other everyday zones", () => {
    expect(timeZoneLabel("Asia/Ho_Chi_Minh", "2027-05-10")).toBe("GMT+7 Vietnam");
    expect(timeZoneLabel("Asia/Tokyo", "2027-05-10")).toBe("GMT+9 Japan");
  });

  it("shows half-hour zones with the minutes", () => {
    expect(timeZoneLabel("Asia/Kolkata", "2027-03-12")).toBe("GMT+5:30 India");
    expect(timeZoneLabel("Asia/Kathmandu", "2027-03-12")).toBe("GMT+5:45 Nepal");
  });

  it("measures daylight saving on the trip's own date", () => {
    expect(timeZoneLabel("Europe/Paris", "2027-01-15")).toBe("GMT+1 France");
    expect(timeZoneLabel("Europe/Paris", "2027-07-15")).toBe("GMT+2 France");
    expect(timeZoneLabel("America/New_York", "2027-01-15")).toBe("GMT-5 US East");
    expect(timeZoneLabel("America/New_York", "2027-07-15")).toBe("GMT-4 US East");
    expect(timeZoneLabel("Australia/Sydney", "2027-01-15")).toBe("GMT+11 Australia");
    expect(timeZoneLabel("Australia/Sydney", "2027-07-15")).toBe("GMT+10 Australia");
  });

  it("shows plain GMT when the offset is zero", () => {
    expect(timeZoneLabel("Europe/London", "2027-01-15")).toBe("GMT UK and Ireland");
    expect(timeZoneLabel("Europe/London", "2027-07-15")).toBe("GMT+1 UK and Ireland");
  });

  it("falls back to the raw name for a zone that is not in the list", () => {
    expect(timeZoneLabel("Not/AZone", "2027-03-12")).toBe("Not/AZone");
    expect(timeZoneLabel("Europe/Lisbon", "2027-03-12")).toBe("Europe/Lisbon");
  });

  it("gives every zone in the list a label that starts with GMT", () => {
    for (const zone of TIME_ZONES) {
      expect(timeZoneLabel(zone.value, "2027-03-12")).toMatch(/^GMT([+-]\d{1,2}(:\d{2})?)? \S/);
    }
  });

  describe("does not depend on the computer's own time zone", () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it.each(["Pacific/Auckland", "America/Los_Angeles", "Pacific/Kiritimati", "Etc/GMT+12"])(
      "gives the same text when the computer's zone is %s",
      (zone) => {
        process.env.TZ = zone;
        expect(timeZoneLabel("Asia/Manila", "2027-03-12")).toBe("GMT+8 Philippines");
        expect(timeZoneLabel("Asia/Kolkata", "2027-03-12")).toBe("GMT+5:30 India");
        expect(timeZoneLabel("Europe/Paris", "2027-07-15")).toBe("GMT+2 France");
        expect(timeZoneLabel("America/New_York", "2027-01-15")).toBe("GMT-5 US East");
      },
    );
  });
});
