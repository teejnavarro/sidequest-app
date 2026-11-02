import { describe, expect, it } from "vitest";
import { isInviteCode } from "./invite-code";

describe("isInviteCode", () => {
  it("accepts a real random id, in either letter case", () => {
    const code = crypto.randomUUID();
    expect(isInviteCode(code)).toBe(true);
    expect(isInviteCode(code.toUpperCase())).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "abc"],
    ["no dashes", "3f2b8c1e9a4d4e7b8c115d6a7b9e0f12"],
    ["not hex", "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"],
    ["extra on the end", `${crypto.randomUUID()}x`],
    ["a path", "../../trips"],
    ["a web address", "https://example.test/evil"],
    ["a new line inside", `${crypto.randomUUID()}\n/evil`],
    ["spaces around", ` ${crypto.randomUUID()} `],
  ])("rejects %s", (_label, value) => {
    expect(isInviteCode(value)).toBe(false);
  });
});
