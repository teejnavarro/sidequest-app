import { describe, expect, it } from "vitest";
import { validateIdeaInput } from "./idea-input";

const valid = {
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: "https://maps.app.goo.gl/abc123",
  area: "District 1",
  costPerPerson: "120",
  notes: "Go early.\nBring small notes.",
};

function errorsFor(overrides: Record<string, unknown>) {
  const result = validateIdeaInput({ ...valid, ...overrides });
  if (result.ok) throw new Error("expected errors");
  return result.errors;
}

function valueFor(overrides: Record<string, unknown>) {
  const result = validateIdeaInput({ ...valid, ...overrides });
  if (!result.ok) throw new Error("expected ok: " + JSON.stringify(result.errors));
  return result.value;
}

describe("validateIdeaInput", () => {
  it("accepts good input and keeps accents and line breaks exactly", () => {
    expect(validateIdeaInput(valid)).toEqual({
      ok: true,
      value: { ...valid, costPerPerson: 120 },
    });
  });

  it.each(["Chợ Bến Thành", "Phở Hòa Pasteur", "Bánh mì 🥖 Huỳnh Hoa", "東京タワー", "Café “No. 1”"])(
    "keeps the name %j exactly",
    (name) => {
      expect(valueFor({ name }).name).toBe(name);
    },
  );

  it("tidies spaces in the name only", () => {
    expect(valueFor({ name: "  Phở   Hòa  " }).name).toBe("Phở Hòa");
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["zero-width", "​‍"],
    ["missing", undefined],
  ])("rejects a %s name", (_label, name) => {
    expect(errorsFor({ name }).name).toBe("Please enter the idea.");
  });

  it("allows 80 characters and rejects 81, counting letters not code units", () => {
    expect(validateIdeaInput({ ...valid, name: "a".repeat(80) }).ok).toBe(true);
    expect(errorsFor({ name: "a".repeat(81) }).name).toBe("Keep it to 80 characters or fewer.");
    expect(validateIdeaInput({ ...valid, name: "😀".repeat(80) }).ok).toBe(true);
    expect(errorsFor({ name: "😀".repeat(81) }).name).toBeDefined();
  });

  it("needs a listed type and duration", () => {
    expect(errorsFor({ type: "" }).type).toBe("Pick a type.");
    expect(errorsFor({ type: "Food" }).type).toBe("Pick a type.");
    expect(errorsFor({ type: undefined }).type).toBe("Pick a type.");
    expect(errorsFor({ duration: "" }).duration).toBe("Pick how long it takes.");
    expect(errorsFor({ duration: "weekend" }).duration).toBe("Pick how long it takes.");
  });

  describe("link", () => {
    it("is optional", () => {
      expect(valueFor({ link: "" }).link).toBeNull();
      expect(valueFor({ link: "   " }).link).toBeNull();
      expect(valueFor({ link: undefined }).link).toBeNull();
    });

    it("accepts web addresses", () => {
      expect(valueFor({ link: "https://example.com/a?b=c" }).link).toBe("https://example.com/a?b=c");
      expect(valueFor({ link: "http://example.com" }).link).toBe("http://example.com");
      expect(valueFor({ link: "  https://example.com  " }).link).toBe("https://example.com");
    });

    it.each([
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "ftp://example.com",
      "example.com",
      "www.example.com",
      "not a link",
      "https://",
    ])("rejects %j", (link) => {
      expect(errorsFor({ link }).link).toBe("Paste a full link, starting with https://");
    });

    it("allows 500 characters and rejects more", () => {
      const base = "https://example.com/";
      expect(validateIdeaInput({ ...valid, link: base + "a".repeat(500 - base.length) }).ok).toBe(true);
      expect(errorsFor({ link: base + "a".repeat(501 - base.length) }).link).toBe("That link is too long.");
    });
  });

  describe("cost", () => {
    it("is optional and blank becomes null", () => {
      expect(valueFor({ costPerPerson: "" }).costPerPerson).toBeNull();
      expect(valueFor({ costPerPerson: "  " }).costPerPerson).toBeNull();
      expect(valueFor({ costPerPerson: undefined }).costPerPerson).toBeNull();
    });

    it("takes whole amounts, with commas and spaces removed", () => {
      expect(valueFor({ costPerPerson: "0" }).costPerPerson).toBe(0);
      expect(valueFor({ costPerPerson: "1,200" }).costPerPerson).toBe(1200);
      expect(valueFor({ costPerPerson: " 1 200 " }).costPerPerson).toBe(1200);
      expect(valueFor({ costPerPerson: "10,000,000" }).costPerPerson).toBe(10_000_000);
    });

    it.each(["12.5", "-5", "abc", "1e3", "₱120", "10,000,001", "123456789", "٣٤"])(
      "rejects %j",
      (costPerPerson) => {
        expect(errorsFor({ costPerPerson }).costPerPerson).toBe("Enter a whole amount, like 120.");
      },
    );
  });

  describe("area and notes", () => {
    it("are optional and blank-looking becomes null", () => {
      expect(valueFor({ area: "", notes: "" })).toMatchObject({ area: null, notes: null });
      expect(valueFor({ area: "   ", notes: "\n  \n" })).toMatchObject({ area: null, notes: null });
      expect(valueFor({ area: "​", notes: "​" })).toMatchObject({ area: null, notes: null });
    });

    it("limits area to 60 and notes to 500", () => {
      expect(validateIdeaInput({ ...valid, area: "a".repeat(60) }).ok).toBe(true);
      expect(errorsFor({ area: "a".repeat(61) }).area).toBe("Keep it to 60 characters or fewer.");
      expect(validateIdeaInput({ ...valid, notes: "a".repeat(500) }).ok).toBe(true);
      expect(errorsFor({ notes: "a".repeat(501) }).notes).toBe("Keep it to 500 characters or fewer.");
    });

    it("keeps the line breaks in notes and turns Windows line ends into plain ones", () => {
      expect(valueFor({ notes: "one\r\ntwo\n\nthree" }).notes).toBe("one\ntwo\n\nthree");
    });
  });

  it("reports every problem at once", () => {
    const errors = errorsFor({
      name: "",
      type: "",
      duration: "",
      link: "nope",
      costPerPerson: "x",
      area: "a".repeat(61),
      notes: "a".repeat(501),
    });
    expect(Object.keys(errors).sort()).toEqual([
      "area",
      "costPerPerson",
      "duration",
      "link",
      "name",
      "notes",
      "type",
    ]);
  });

  it("ignores fields it does not know", () => {
    const result = validateIdeaInput({ ...valid, createdBy: "someone-else", tripId: "other", id: "x" });
    expect(result).toEqual({ ok: true, value: { ...valid, costPerPerson: 120 } });
  });
});
