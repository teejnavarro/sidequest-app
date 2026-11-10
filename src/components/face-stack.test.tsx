import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaceStack } from "./face-stack";

const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Person${i} Test`, image: null, isGuest: false }));

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

  it("keeps account ids out of the page source when decorative", () => {
    const keys = (decorative: boolean) => {
      const stack = FaceStack({ people: people(3), borderClass: "border-card", decorative });
      const [faces] = stack!.props.children as [{ key: string }[]];
      return faces.map((face) => face.key);
    };
    expect(keys(true)).toEqual(["0", "1", "2"]);
    expect(keys(false)).toEqual(["u0", "u1", "u2"]);
  });

  it("draws guests on the plain gray circle and keeps people's colors, signed in or not", () => {
    const mixed = [
      { id: "u1", name: "Maya Test", image: null, isGuest: false },
      { id: "spot-2", name: "Dana Guest", image: null, isGuest: true },
    ];
    for (const decorative of [false, true]) {
      const html = renderToStaticMarkup(
        <FaceStack people={mixed} borderClass="border-card" decorative={decorative} />,
      );
      const faces = html.match(/<span[^>]*class="inline-grid[^"]*"[^>]*>[A-Z]{2}<\/span>/g) ?? [];
      expect(faces).toHaveLength(2);
      const [person, guest] = faces;
      expect(person).toContain(">MT<");
      expect(person).toContain("text-on-face");
      expect(person).not.toContain("bg-chip");
      expect(guest).toContain(">DG<");
      expect(guest).toContain("bg-chip text-ink");
      expect(guest).not.toContain("text-on-face");
    }
  });

  it("renders nothing for nobody", () => {
    expect(renderToStaticMarkup(<FaceStack people={[]} borderClass="border-card" />)).toBe("");
  });
});
