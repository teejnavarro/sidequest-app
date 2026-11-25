import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Face } from "./face";

describe("Face", () => {
  it("shows initials on the person's color", () => {
    const html = renderToStaticMarkup(<Face userId="u1" name="Maya Cruz" image={null} />);
    expect(html).toContain("MC");
    expect(html).toContain("text-on-face");
  });

  it("shows a quiet person icon, never initials, for a deleted account", () => {
    const html = renderToStaticMarkup(<Face userId="u1" name="Former member" image={null} />);
    expect(html).toContain('aria-label="Former member"');
    expect(html).toContain("bg-chip");
    expect(html).toContain("<svg");
    expect(html).not.toContain("FM");
    expect(html).not.toContain("text-on-face");
  });

  it("keeps the deleted account's face silent when decorative", () => {
    const html = renderToStaticMarkup(<Face userId="u1" name="Former member" image={null} decorative />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain("Former member");
  });

  it("leaves a guest's neutral circle as it was", () => {
    const html = renderToStaticMarkup(<Face userId="g1" name="Dana Reyes" image={null} neutral />);
    expect(html).toContain("DR");
    expect(html).toContain("bg-chip text-ink");
  });
});
