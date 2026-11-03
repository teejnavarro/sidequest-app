import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaceStack } from "./face-stack";

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Person${i} Test`, image: null }));

describe("FaceStack", () => {
  it("shows up to five faces and no extra circle", () => {
    const html = renderToStaticMarkup(<FaceStack people={people(5)} borderClass="border-card" />);
    expect((html.match(/aria-label="Person/g) ?? []).length).toBe(5);
    expect(html).not.toContain("+");
  });

  it("shows five faces and a +n circle for the rest", () => {
    const html = renderToStaticMarkup(<FaceStack people={people(8)} borderClass="border-card" />);
    expect((html.match(/aria-label="Person/g) ?? []).length).toBe(5);
    expect(html).toContain("+3");
    expect(html).toContain("bg-chip");
    expect(html).toContain('aria-label="and 3 more"');
  });

  it("uses the border class it was given", () => {
    const html = renderToStaticMarkup(<FaceStack people={people(2)} borderClass="border-band" />);
    expect(html).toContain("border-band");
  });

  it("is silent when decorative: no names, labels or roles", () => {
    const html = renderToStaticMarkup(
      <FaceStack people={people(8)} borderClass="border-card" decorative />,
    );
    expect(html).not.toContain("Person");
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("+3");
  });

  it("renders nothing for nobody", () => {
    expect(renderToStaticMarkup(<FaceStack people={[]} borderClass="border-card" />)).toBe("");
  });
});
