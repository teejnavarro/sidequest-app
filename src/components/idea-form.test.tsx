import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IdeaForm } from "./idea-form";
import { emptyIdeaValues } from "@/lib/idea-form-state";

vi.mock("@/app/trips/[tripId]/ideas/actions", () => ({
  createIdeaAction: async () => ({ errors: {}, values: {} }),
  updateIdeaAction: async () => ({ errors: {}, values: {} }),
}));

const filled = {
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: "https://maps.app.goo.gl/abc",
  area: "District 1",
  costPerPerson: "120",
  notes: "Go early.",
};

const create = (values = emptyIdeaValues, currency = "PHP") =>
  renderToStaticMarkup(<IdeaForm mode="create" tripId="trip-1" currency={currency} values={values} />);

describe("IdeaForm", () => {
  it("keeps every field name the server reads, plus the trip id", () => {
    const html = create();
    for (const name of ["name", "type", "duration", "link", "area", "costPerPerson", "notes", "tripId"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('value="trip-1"');
    expect(html).not.toContain('name="ideaId"');
  });

  it("carries the idea id when editing", () => {
    const html = renderToStaticMarkup(
      <IdeaForm mode="edit" tripId="trip-1" ideaId="idea-1" currency="PHP" values={filled} />,
    );
    expect(html).toContain('name="ideaId"');
    expect(html).toContain('value="idea-1"');
    expect(html).toContain("Save changes");
    expect(html).not.toContain(">Add idea<");
  });

  it("uses the approved labels, hints and help", () => {
    const html = create();
    expect(html).toContain("What&#x27;s the idea?");
    expect(html).toContain('placeholder="Bánh mì Huỳnh Hoa"');
    expect(html).toContain(">Type<");
    expect(html).toContain(">How long?<");
    expect(html).toContain(">Optional<");
    expect(html).toContain("Google Maps link");
    expect(html).toContain('placeholder="Paste it from Google Maps"');
    expect(html).toContain("Share the place in Google Maps, then copy the link. It pins down the exact spot.");
    expect(html).toContain("A rough guess is fine.");
    expect(html).toContain('placeholder="District 1"');
    expect(html).toContain(">Add idea<");
  });

  it("makes the link box a web address box and the cost box a number box", () => {
    const html = create();
    expect(html).toMatch(/<input[^>]*id="link"[^>]*type="url"[^>]*inputMode="url"/);
    expect(html).toMatch(/<input[^>]*id="costPerPerson"[^>]*inputMode="numeric"/);
  });

  it("offers all seven types and the three durations as radio chips, with none chosen at first", () => {
    const html = create();
    for (const label of ["Food", "Sightseeing", "Adventure", "Experience", "Shopping", "Nightlife", "Other"]) {
      expect(html).toContain(`${label}</span>`);
    }
    for (const label of ["1–2 hrs", "Half day", "Full day"]) expect(html).toContain(`${label}</span>`);
    expect(html.match(/type="radio"/g)).toHaveLength(10);
    expect(html).not.toContain('checked=""');
  });

  it("keeps the chosen type and duration after an error", () => {
    const html = create(filled);
    const checked = html.match(/<input[^>]*type="radio"[^>]*checked=""[^>]*>/g) ?? [];
    expect(checked).toHaveLength(2);
    expect(checked.join(" ")).toContain('value="sightseeing"');
    expect(checked.join(" ")).toContain('value="half"');
  });

  it("keeps what was typed", () => {
    const html = create(filled);
    expect(html).toContain('value="Chợ Bến Thành"');
    expect(html).toContain('value="https://maps.app.goo.gl/abc"');
    expect(html).toContain('value="District 1"');
    expect(html).toContain('value="120"');
    expect(html).toContain("Go early.");
  });

  it("shows the trip's currency symbol before the cost box", () => {
    expect(create(emptyIdeaValues, "PHP")).toContain(">₱<");
    expect(create(emptyIdeaValues, "VND")).toContain(">₫<");
  });

  it("gives the radio chips a 44px target and a visible focus style", () => {
    const html = create();
    expect(html).toContain("min-h-11");
    expect(html).toContain("peer-focus-visible:outline-2");
  });
});
