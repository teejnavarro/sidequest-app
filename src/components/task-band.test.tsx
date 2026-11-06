import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskBand } from "./task-band";

describe("TaskBand", () => {
  const html = renderToStaticMarkup(
    <TaskBand backHref="/trips/trip-1" backLabel="Hội An long weekend" title="Edit trip" />,
  );

  it("has a back link to the given place, named for it, and the page title as the one heading", () => {
    expect(html).toContain('href="/trips/trip-1"');
    expect(html).toContain("Hội An long weekend");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(">Edit trip</h1>");
  });

  it("keeps the light back-link color and wraps or shortens long text instead of overflowing", () => {
    expect(html).toContain("text-band-muted!");
    expect(html).toContain("truncate");
    expect(html).toContain("wrap-anywhere");
  });

  it("has no tab bar", () => {
    expect(html).not.toContain("Trip sections");
  });
});
