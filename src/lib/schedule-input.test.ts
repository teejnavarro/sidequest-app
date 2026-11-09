import { describe, expect, it } from "vitest";
import { validateScheduleInput } from "./schedule-input";

const DAYS = ["2027-05-08", "2027-05-09"];
const newItem = {
  kind: "new",
  name: "Airport transfer",
  notes: "Meet at arrivals.\nBook a van.",
  day: "2027-05-08",
  slot: "time",
  time: "19:30",
};
const ideaItem = { kind: "idea", ideaId: "idea-1", day: "2027-05-09", slot: "morning" };

function errorsFor(raw: Record<string, unknown>) {
  const result = validateScheduleInput(raw, DAYS);
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

describe("validateScheduleInput", () => {
  it("accepts a new item and keeps line breaks in the notes", () => {
    expect(validateScheduleInput(newItem, DAYS)).toEqual({
      ok: true,
      value: {
        kind: "new",
        name: "Airport transfer",
        notes: "Meet at arrivals.\nBook a van.",
        day: "2027-05-08",
        slot: "time",
        time: "19:30",
      },
    });
  });

  it("accepts an idea and ignores any name or notes", () => {
    expect(validateScheduleInput({ ...ideaItem, name: "", notes: "x".repeat(999) }, DAYS)).toEqual({
      ok: true,
      value: { kind: "idea", ideaId: "idea-1", day: "2027-05-09", slot: "morning", time: null },
    });
  });

  it("treats anything but kind idea as a new item", () => {
    expect(errorsFor({ ...newItem, kind: "other", name: "" }).name).toBe("Please enter a name.");
  });

  it("requires an idea for an idea item", () => {
    expect(errorsFor({ ...ideaItem, ideaId: "" }).ideaId).toBe("Pick an idea.");
  });

  it.each(["", "2027-05-10", "2027-5-8", "nonsense"])("rejects the day %j", (day) => {
    expect(errorsFor({ ...newItem, day }).day).toBe("Pick a day.");
  });

  it.each(["", "later", "TIME"])("rejects the slot %j", (slot) => {
    expect(errorsFor({ ...newItem, slot }).slot).toBe("Pick when.");
  });

  it("ignores the time unless the slot is an exact time", () => {
    const result = validateScheduleInput({ ...newItem, slot: "evening", time: "nonsense" }, DAYS);
    expect(result).toMatchObject({ ok: true, value: { slot: "evening", time: null } });
  });

  it.each(["", "7:30", "24:00", "19:60", "19:3", "19.30", "abc"])("rejects the exact time %j", (time) => {
    expect(errorsFor({ ...newItem, time }).time).toBe("Enter a time, like 19:30.");
  });

  it.each(["00:00", "09:05", "23:59"])("accepts the exact time %s", (time) => {
    expect(validateScheduleInput({ ...newItem, time }, DAYS)).toMatchObject({ ok: true, value: { time } });
  });

  it.each([["empty", ""], ["spaces", "   "], ["zero-width", "​‍"], ["missing", undefined]])(
    "rejects a %s name",
    (_label, name) => {
      expect(errorsFor({ ...newItem, name }).name).toBe("Please enter a name.");
    },
  );

  it("tidies spaces and keeps accents in the name", () => {
    expect(validateScheduleInput({ ...newItem, name: "  Phở   Hòa " }, DAYS)).toMatchObject({
      value: { name: "Phở Hòa" },
    });
  });

  it("allows 80 characters in a name and 300 in notes, and rejects one more", () => {
    expect(validateScheduleInput({ ...newItem, name: "a".repeat(80), notes: "b".repeat(300) }, DAYS).ok).toBe(true);
    expect(errorsFor({ ...newItem, name: "a".repeat(81) }).name).toBe("Keep it to 80 characters or fewer.");
    expect(errorsFor({ ...newItem, notes: "b".repeat(301) }).notes).toBe("Keep it to 300 characters or fewer.");
    expect(validateScheduleInput({ ...newItem, name: "😀".repeat(80) }, DAYS).ok).toBe(true);
  });

  it("treats blank notes as none", () => {
    expect(validateScheduleInput({ ...newItem, notes: "  \n " }, DAYS)).toMatchObject({
      value: { notes: null },
    });
  });

  it("reports every problem at once", () => {
    expect(Object.keys(errorsFor({ kind: "new" })).sort()).toEqual(["day", "name", "slot"]);
  });
});
