import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TripForm } from "./trip-form";
import { emptyTripValues } from "@/lib/trip-form-state";

vi.mock("@/app/trips/actions", () => ({
  createTripAction: async () => ({ errors: {}, values: {} }),
  updateTripAction: async () => ({ errors: {}, values: {} }),
}));

const trip = {
  ...emptyTripValues,
  name: "Hội An long weekend",
  destination: "Hội An",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
};

const html = (values = emptyTripValues) =>
  renderToStaticMarkup(<TripForm mode="create" values={values} />);

describe("TripForm", () => {
  it("keeps every field name the server reads", () => {
    const page = html();
    for (const name of ["name", "destination", "startDate", "endDate", "timeZone", "currency"]) {
      expect(page).toContain(`name="${name}"`);
    }
    expect(renderToStaticMarkup(<TripForm mode="edit" tripId="t1" values={trip} />)).toContain(
      'name="tripId"',
    );
  });

  it("locks the currency once the trip has costs: disabled select, hidden value, new help", () => {
    const locked = renderToStaticMarkup(<TripForm mode="edit" tripId="t1" currencyLocked values={{ ...trip, currency: "VND" }} />);
    expect(locked).toContain('<input type="hidden" name="currency" value="VND"/>');
    expect(locked.match(/name="currency"/g)).toHaveLength(1);
    expect(locked).toMatch(/<select id="currency"[^>]*disabled/);
    expect(locked).toContain("Can&#x27;t change once costs are logged, including any in the trash.");
    const open = renderToStaticMarkup(<TripForm mode="edit" tripId="t1" values={trip} />);
    expect(open).not.toContain('type="hidden" name="currency"');
    expect(open).toMatch(/<select id="currency" name="currency"/);
    expect(open).toContain("Costs are added up in this currency.");
  });

  it("groups the fields as The trip, When and Details", () => {
    const page = html();
    expect(page.match(/<fieldset/g)).toHaveLength(3);
    for (const title of ["The trip", "When", "Details"]) {
      expect(page).toContain(`>${title}</legend>`);
    }
  });

  it("uses the new labels, hints and help", () => {
    const page = html();
    expect(page).toContain(">Leaving<");
    expect(page).toContain(">Back<");
    expect(page).toContain("Where to? (optional)");
    expect(page).toContain('placeholder="Siargao with the org"');
    expect(page).toContain('placeholder="Siargao"');
    expect(page).toContain("Times in the plan use this place&#x27;s clock.");
    expect(page).not.toContain("Start date");
    expect(page).not.toContain("End date");
  });

  it("stacks the dates below 360px and puts them side by side from 360px", () => {
    expect(html()).toContain("min-[360px]:grid-cols-2");
  });

  it("lists the currencies as name and symbol", () => {
    expect(html()).toContain("Philippine peso (₱)");
  });

  it("shows the route line only once both dates are real and the end is not before the start", () => {
    expect(html()).not.toContain("Mar 12");
    expect(html({ ...trip, endDate: "" })).not.toContain("Mar 12");
    expect(html({ ...trip, startDate: "" })).not.toContain("Mar 15");
    expect(html({ ...trip, endDate: "2027-03-01" })).not.toContain("Mar 12");
    expect(html({ ...trip, startDate: "2027-02-30" })).not.toContain("Feb 30");

    const shown = html(trip);
    expect(shown).toContain("Mar 12");
    expect(shown).toContain("Mar 15, 2027");
    // A one-day trip is allowed.
    expect(html({ ...trip, endDate: "2027-03-12" })).toContain("Mar 12, 2027");
  });

  it("puts the dropdown arrow where it can't be tapped", () => {
    expect(html()).toContain("pointer-events-none");
  });
});
