import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JoinForm } from "./join-form";

vi.mock("../actions", () => ({ joinTripAction: async () => ({ message: "" }) }));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";

describe("JoinForm with no guests in the trip", () => {
  const html = renderToStaticMarkup(<JoinForm code={CODE} />);

  it("looks exactly as before: the code and one Join trip button", () => {
    expect(html).toContain(`name="code" value="${CODE}"`);
    expect(html).toContain("Join trip");
    expect(html).not.toContain("fieldset");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain("Are you already");
  });

  it("treats an empty list the same as no list", () => {
    expect(renderToStaticMarkup(<JoinForm code={CODE} guests={[]} />)).toBe(html);
  });
});

describe("JoinForm with guests", () => {
  const guests = [
    { id: "spot-1", name: "Lito Cruz" },
    { id: "spot-2", name: "Tita Carmen" },
  ];
  const html = renderToStaticMarkup(<JoinForm code={CODE} guests={guests} />);

  it("asks the question, with one radio per guest and one for No, I'm new", () => {
    expect(html).toContain("<fieldset");
    expect(html).toContain("Are you already on this trip as a guest?");
    expect(html).toContain("Yes, I&#x27;m Lito Cruz");
    expect(html).toContain("Yes, I&#x27;m Tita Carmen");
    expect(html).toContain("No, I&#x27;m new to this trip");
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html).toContain('name="claim" value="spot-1"');
    expect(html).toContain('name="claim" value="spot-2"');
    expect(html).toContain('name="claim" value="new"');
  });

  it("wraps a long guest name inside its option instead of widening the page", () => {
    const long = renderToStaticMarkup(<JoinForm code={CODE} guests={[{ id: "spot-9", name: "W".repeat(40) }]} />);
    expect(long).toMatch(/<label class="[^"]*\bmin-w-0\b[^"]*">(?:(?!<\/label>).)*<span class="min-w-0 wrap-anywhere">Yes, I&#x27;m W{40}<\/span><\/label>/);
  });

  it("checks none of them, so the person has to choose", () => {
    expect(html).not.toMatch(/\schecked[\s=/>]/);
  });

  it("explains that picking a name keeps what was added, and shows initials faces", () => {
    expect(html).toContain("Picking your name keeps everything already added for you.");
    expect(html).toContain("LC");
    expect(html).toContain("TC");
  });

  it("says Join trip until a name is picked (and without JavaScript)", () => {
    expect(html).toContain("Join trip");
    expect(html).not.toContain("Join as");
  });

  it("sends only the code and the answer, never who the person is", () => {
    expect(html).not.toContain("userId");
  });
});
