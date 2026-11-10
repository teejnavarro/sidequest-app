import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AddGuestForm } from "./add-guest-form";

vi.mock("@/app/trips/[tripId]/guests/actions", () => ({ addGuestAction: async () => ({ name: "" }) }));

describe("AddGuestForm", () => {
  const html = renderToStaticMarkup(<AddGuestForm tripId="trip-1" />);

  it("has the label, help line, a name box and a quiet Add button", () => {
    expect(html).toContain("Add a guest");
    expect(html).toContain("For friends who won&#x27;t sign up.");
    expect(html).toContain("They can take over their spot later by joining with the link.");
    expect(html).toMatch(/<label[^>]*for="guest-name"[^>]*>Guest&#x27;s name<\/label>/);
    expect(html).toContain('name="name"');
    expect(html).toContain(">Add</button>");
  });

  it("sends the trip id as a hidden field and nothing about who is adding", () => {
    expect(html).toContain('name="tripId" value="trip-1"');
    expect(html).not.toContain("userId");
    expect(html).not.toContain("addedBy");
  });

  it("connects the help line to the box and has an empty alert area for errors", () => {
    expect(html).toContain('aria-describedby="guest-name-help"');
    expect(html).toContain('id="guest-name-help"');
    expect(html).toMatch(/<p id="guest-name-error" role="alert"[^>]*><\/p>/);
  });
});
