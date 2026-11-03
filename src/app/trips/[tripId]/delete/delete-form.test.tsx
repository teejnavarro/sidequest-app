import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeleteForm } from "./delete-form";

vi.mock("@/app/trips/actions", () => ({ deleteTripAction: vi.fn() }));

describe("DeleteForm", () => {
  it("sends this trip's id and offers the Delete trip button", () => {
    const html = renderToStaticMarkup(<DeleteForm tripId="trip-1" />);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="tripId"[^>]*value="trip-1"/);
    expect(html).toContain("Delete trip");
    expect(html).not.toContain(' disabled=""');
  });
});
