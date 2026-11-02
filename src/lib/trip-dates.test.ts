import { afterEach, describe, expect, it } from "vitest";
import { formatTripDates, formatTripRange } from "./trip-dates";

describe("formatTripRange", () => {
  it("shortens a trip inside one month", () => {
    expect(formatTripRange("2027-03-12", "2027-03-15")).toBe("Mar 12-15, 2027");
  });

  it("names both months across months", () => {
    expect(formatTripRange("2027-03-30", "2027-04-02")).toBe("Mar 30-Apr 2, 2027");
  });

  it("shows both years across years", () => {
    expect(formatTripRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026-Jan 2, 2027");
  });

  it("shows a one-day trip as one date", () => {
    expect(formatTripRange("2027-03-12", "2027-03-12")).toBe("Mar 12, 2027");
  });
});

describe("formatTripDates", () => {
  it("leaves the year off the start when both are in one year", () => {
    expect(formatTripDates("2027-03-12", "2027-03-15")).toEqual({
      start: "Mar 12",
      end: "Mar 15, 2027",
    });
  });

  it("shows both years across years", () => {
    expect(formatTripDates("2026-12-30", "2027-01-02")).toEqual({
      start: "Dec 30, 2026",
      end: "Jan 2, 2027",
    });
  });

  it("handles a one-day trip", () => {
    expect(formatTripDates("2027-03-12", "2027-03-12")).toEqual({
      start: "Mar 12",
      end: "Mar 12, 2027",
    });
  });
});

describe("time zone safety", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it.each(["Pacific/Auckland", "America/Los_Angeles", "Pacific/Kiritimati", "Etc/GMT+12"])(
    "gives the same text when the computer's own zone is %s",
    (zone) => {
      process.env.TZ = zone;
      expect(formatTripRange("2027-03-12", "2027-03-15")).toBe("Mar 12-15, 2027");
      expect(formatTripRange("2027-03-30", "2027-04-02")).toBe("Mar 30-Apr 2, 2027");
      expect(formatTripDates("2027-01-01", "2027-01-01")).toEqual({
        start: "Jan 1",
        end: "Jan 1, 2027",
      });
    },
  );
});
