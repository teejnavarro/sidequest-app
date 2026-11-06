import { afterEach, describe, expect, it } from "vitest";
import {
  formatTripDates,
  formatTripRange,
  isCalendarDay,
  todayInZone,
  tripTimeLabel,
} from "./trip-dates";

describe("formatTripRange", () => {
  it("shortens a trip inside one month", () => {
    expect(formatTripRange("2027-03-12", "2027-03-15")).toBe("Mar 12–15, 2027");
  });

  it("names both months across months", () => {
    expect(formatTripRange("2027-03-30", "2027-04-02")).toBe("Mar 30–Apr 2, 2027");
  });

  it("shows both years across years", () => {
    expect(formatTripRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026–Jan 2, 2027");
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
      expect(formatTripRange("2027-03-12", "2027-03-15")).toBe("Mar 12–15, 2027");
      expect(formatTripRange("2027-03-30", "2027-04-02")).toBe("Mar 30–Apr 2, 2027");
      expect(formatTripDates("2027-01-01", "2027-01-01")).toEqual({
        start: "Jan 1",
        end: "Jan 1, 2027",
      });
    },
  );
});

describe("tripTimeLabel", () => {
  const start = "2027-03-12";
  const end = "2027-03-15";

  it("counts the days before the trip", () => {
    expect(tripTimeLabel(start, end, "2027-02-28")).toBe("In 12 days");
    expect(tripTimeLabel(start, end, "2027-03-10")).toBe("In 2 days");
  });

  it("says Tomorrow the day before, in place of 'In 1 days'", () => {
    expect(tripTimeLabel(start, end, "2027-03-11")).toBe("Tomorrow");
  });

  it("counts the day of the trip, from the first to the last", () => {
    expect(tripTimeLabel(start, end, "2027-03-12")).toBe("Day 1 of 4");
    expect(tripTimeLabel(start, end, "2027-03-13")).toBe("Day 2 of 4");
    expect(tripTimeLabel(start, end, "2027-03-15")).toBe("Day 4 of 4");
  });

  it("says the trip is over from the day after", () => {
    expect(tripTimeLabel(start, end, "2027-03-16")).toBe("Trip's over");
    expect(tripTimeLabel(start, end, "2030-01-01")).toBe("Trip's over");
  });

  it("handles a one-day trip: before, today, after", () => {
    expect(tripTimeLabel("2027-03-12", "2027-03-12", "2027-03-11")).toBe("Tomorrow");
    expect(tripTimeLabel("2027-03-12", "2027-03-12", "2027-03-12")).toBe("Today");
    expect(tripTimeLabel("2027-03-12", "2027-03-12", "2027-03-13")).toBe("Trip's over");
  });

  it("counts across a month end, a year end and a leap day", () => {
    expect(tripTimeLabel("2027-03-02", "2027-03-05", "2027-02-27")).toBe("In 3 days");
    expect(tripTimeLabel("2027-01-03", "2027-01-05", "2026-12-30")).toBe("In 4 days");
    expect(tripTimeLabel("2028-03-01", "2028-03-03", "2028-02-28")).toBe("In 2 days");
    expect(tripTimeLabel("2026-12-30", "2027-01-02", "2027-01-01")).toBe("Day 3 of 4");
  });
});

describe("todayInZone", () => {
  // 2027-03-12 20:00 UTC is already the 13th in Manila and still the 12th in Los Angeles.
  const moment = new Date("2027-03-12T20:00:00Z");

  it("gives the day it is in the trip's own zone, not the viewer's", () => {
    expect(todayInZone("Asia/Manila", moment)).toBe("2027-03-13");
    expect(todayInZone("America/Los_Angeles", moment)).toBe("2027-03-12");
    expect(todayInZone("UTC", moment)).toBe("2027-03-12");
  });

  it("moves with the trip's clock around midnight", () => {
    expect(todayInZone("Asia/Manila", new Date("2027-03-12T15:59:59Z"))).toBe("2027-03-12");
    expect(todayInZone("Asia/Manila", new Date("2027-03-12T16:00:00Z"))).toBe("2027-03-13");
  });

  it("falls back to UTC for an unknown zone", () => {
    expect(todayInZone("Not/AZone", moment)).toBe("2027-03-12");
  });

  it("lets a trip start 'Today' in Manila while it is still 'Tomorrow' in Los Angeles", () => {
    const manila = todayInZone("Asia/Manila", moment);
    const losAngeles = todayInZone("America/Los_Angeles", moment);
    expect(tripTimeLabel("2027-03-13", "2027-03-13", manila)).toBe("Today");
    expect(tripTimeLabel("2027-03-13", "2027-03-13", losAngeles)).toBe("Tomorrow");
  });

  it.each(["Pacific/Auckland", "America/Los_Angeles", "Pacific/Kiritimati", "Etc/GMT+12"])(
    "gives the same answers when the computer's own zone is %s",
    (zone) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = zone;
        expect(todayInZone("Asia/Manila", moment)).toBe("2027-03-13");
        expect(todayInZone("Not/AZone", moment)).toBe("2027-03-12");
        expect(tripTimeLabel("2027-03-12", "2027-03-15", "2027-03-13")).toBe("Day 2 of 4");
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    },
  );
});

describe("isCalendarDay", () => {
  it("accepts real days, including a leap day", () => {
    expect(isCalendarDay("2027-03-12")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
  });

  it.each(["", "2027-02-30", "2027-02-29", "2027-13-01", "27-03-12", "2027-3-12", "12/03/2027", "2027-03-12x"])(
    "rejects %j",
    (value) => {
      expect(isCalendarDay(value)).toBe(false);
    },
  );
});
