import { describe, expect, it } from "vitest";
import { compareItems, dayLabel, formatTime, sortKey, tripDays, whenLabel } from "./schedule-options";

describe("tripDays", () => {
  it("lists a one-day trip", () => {
    expect(tripDays("2027-05-08", "2027-05-08")).toEqual([
      { day: "2027-05-08", label: "Sat, May 8", short: "Sat 8", number: 1 },
    ]);
  });

  it("lists every day, numbered from 1, across a month end", () => {
    const days = tripDays("2027-03-30", "2027-04-02");
    expect(days.map((d) => d.day)).toEqual(["2027-03-30", "2027-03-31", "2027-04-01", "2027-04-02"]);
    expect(days.map((d) => d.number)).toEqual([1, 2, 3, 4]);
    expect(days[2].label).toBe("Thu, Apr 1");
  });

  it("lists every day across a year end and a leap day", () => {
    expect(tripDays("2027-12-30", "2028-01-02").map((d) => d.day)).toEqual([
      "2027-12-30",
      "2027-12-31",
      "2028-01-01",
      "2028-01-02",
    ]);
    expect(tripDays("2028-02-28", "2028-03-01").map((d) => d.day)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });
});

describe("dayLabel", () => {
  it("writes the weekday, month and day", () => {
    expect(dayLabel("2027-05-09")).toBe("Sun, May 9");
  });
});

describe("sortKey", () => {
  it("orders Full day, Morning, 09:30, Afternoon, 12:00, Evening, 19:30", () => {
    const items = [
      { slot: "time", time: "19:30" },
      { slot: "evening", time: null },
      { slot: "time", time: "12:00" },
      { slot: "afternoon", time: null },
      { slot: "time", time: "09:30" },
      { slot: "morning", time: null },
      { slot: "full", time: null },
    ];
    const sorted = [...items].sort((a, b) => sortKey(a.slot, a.time) - sortKey(b.slot, b.time));
    expect(sorted.map((i) => i.time ?? i.slot)).toEqual([
      "full",
      "morning",
      "09:30",
      "afternoon",
      "12:00",
      "evening",
      "19:30",
    ]);
  });

  it("puts midnight and the end of the day where they belong", () => {
    expect(sortKey("time", "00:00")).toBeGreaterThan(sortKey("morning", null));
    expect(sortKey("time", "23:59")).toBeGreaterThan(sortKey("evening", null));
    expect(sortKey("time", "16:59")).toBeLessThan(sortKey("evening", null));
    expect(sortKey("time", "11:59")).toBeLessThan(sortKey("afternoon", null));
  });
});

describe("compareItems", () => {
  it("breaks ties by the time the item was added", () => {
    const early = { slot: "morning", time: null, createdAt: new Date(1000) };
    const late = { slot: "morning", time: null, createdAt: new Date(2000) };
    expect([late, early].sort(compareItems)).toEqual([early, late]);
  });
});

describe("labels", () => {
  it("shows an exact time as typed and other slots by name", () => {
    expect(formatTime("19:30")).toBe("19:30");
    expect(whenLabel("time", "07:05")).toBe("07:05");
    expect(whenLabel("full", null)).toBe("Full day");
    expect(whenLabel("afternoon", null)).toBe("Afternoon");
  });
});
