import { describe, expect, it } from "vitest";
import { validateTripInput } from "./trip-input";

const valid = {
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  destination: "Đà Nẵng, Việt Nam",
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = validateTripInput({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

describe("validateTripInput", () => {
  it("accepts good input and keeps accents exactly", () => {
    expect(validateTripInput(valid)).toEqual({ ok: true, value: valid });
  });

  it("keeps emoji and other scripts in the name", () => {
    const result = validateTripInput({ ...valid, name: "Café 東京 ✈️" });
    expect(result).toMatchObject({ ok: true, value: { name: "Café 東京 ✈️" } });
  });

  it("tidies spaces in the name", () => {
    const result = validateTripInput({ ...valid, name: "  Bohol   trip  " });
    expect(result).toMatchObject({ ok: true, value: { name: "Bohol trip" } });
  });

  it.each([
    ["empty", ""],
    ["spaces", "    "],
    ["zero-width", "​‍"],
    ["blank braille", "⠀⠀"],
    ["missing", undefined],
  ])("rejects a %s name", (_label, name) => {
    expect(errorsFor({ name }).name).toBe("Please enter a trip name.");
  });

  it("allows 60 characters and rejects 61", () => {
    expect(validateTripInput({ ...valid, name: "a".repeat(60) }).ok).toBe(true);
    expect(errorsFor({ name: "a".repeat(61) }).name).toBe(
      "Keep it to 60 characters or fewer.",
    );
  });

  it("counts letters, not code units, for the length", () => {
    expect(validateTripInput({ ...valid, name: "😀".repeat(60) }).ok).toBe(true);
    expect(errorsFor({ name: "😀".repeat(61) }).name).toBe(
      "Keep it to 60 characters or fewer.",
    );
  });

  it("rejects a day that does not exist", () => {
    expect(errorsFor({ startDate: "2027-02-30", endDate: "2027-03-01" }).startDate).toBe(
      "That date does not exist. Check the day and month.",
    );
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(
      validateTripInput({ ...valid, startDate: "2028-02-29", endDate: "2028-03-01" }).ok,
    ).toBe(true);
    expect(errorsFor({ startDate: "2027-02-29" }).startDate).toBeDefined();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong shape", "12/03/2027"],
  ])("asks for a start date when it is %s", (_label, startDate) => {
    expect(errorsFor({ startDate }).startDate).toBe("Pick the day you leave.");
  });

  it("asks for an end date when it is missing", () => {
    expect(errorsFor({ endDate: "" }).endDate).toBe("Pick the day you're back.");
  });

  it("limits years to 2000-2100", () => {
    const message = "Pick a year between 2000 and 2100.";
    expect(errorsFor({ startDate: "1999-12-31", endDate: "2027-01-01" }).startDate).toBe(message);
    expect(errorsFor({ endDate: "2101-01-01" }).endDate).toBe(message);
    expect(validateTripInput({ ...valid, startDate: "2000-01-01" }).ok).toBe(true);
    expect(validateTripInput({ ...valid, endDate: "2100-12-31" }).ok).toBe(true);
  });

  it("rejects an end before the start", () => {
    expect(errorsFor({ startDate: "2027-03-15", endDate: "2027-03-12" }).endDate).toBe(
      "The day you're back can't be before the day you leave.",
    );
  });

  it("allows a one-day trip and past dates", () => {
    expect(
      validateTripInput({ ...valid, startDate: "2027-03-12", endDate: "2027-03-12" }).ok,
    ).toBe(true);
    expect(
      validateTripInput({ ...valid, startDate: "2010-05-01", endDate: "2010-05-03" }).ok,
    ).toBe(true);
  });

  it("rejects an unknown time zone", () => {
    const message = "Pick a time zone from the list.";
    expect(errorsFor({ timeZone: "Mars/Olympus" }).timeZone).toBe(message);
    expect(errorsFor({ timeZone: "" }).timeZone).toBe(message);
    expect(errorsFor({ timeZone: undefined }).timeZone).toBe(message);
  });

  it("rejects an unknown currency", () => {
    const message = "Pick a currency from the list.";
    expect(errorsFor({ currency: "XYZ" }).currency).toBe(message);
    expect(errorsFor({ currency: "php" }).currency).toBe(message);
  });

  it("reports every problem at once", () => {
    const errors = errorsFor({
      name: "",
      startDate: "",
      endDate: "",
      timeZone: "x",
      currency: "x",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "currency",
      "endDate",
      "name",
      "startDate",
      "timeZone",
    ]);
  });

  it("ignores fields it does not know", () => {
    const result = validateTripInput({ ...valid, ownerId: "someone-else", id: "abc" });
    expect(result).toEqual({ ok: true, value: valid });
  });
});

describe("destination", () => {
  it("keeps accents exactly and tidies spaces", () => {
    const result = validateTripInput({ ...valid, destination: "  Hội   An  " });
    expect(result).toMatchObject({ ok: true, value: { destination: "Hội An" } });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["spaces", "    "],
    ["zero-width", "​‍"],
    ["blank braille", "⠀"],
    ["not text", 42],
  ])("saves %s as no destination", (_label, destination) => {
    const result = validateTripInput({ ...valid, destination });
    expect(result).toMatchObject({ ok: true, value: { destination: null } });
  });

  it("allows 60 characters and rejects 61 with a plain message", () => {
    expect(validateTripInput({ ...valid, destination: "ñ".repeat(60) }).ok).toBe(true);
    expect(errorsFor({ destination: "ñ".repeat(61) }).destination).toBe(
      "Keep it to 60 characters or fewer.",
    );
  });

  it("counts letters, not code units", () => {
    expect(validateTripInput({ ...valid, destination: "😀".repeat(60) }).ok).toBe(true);
    expect(errorsFor({ destination: "😀".repeat(61) }).destination).toBeDefined();
  });
});
