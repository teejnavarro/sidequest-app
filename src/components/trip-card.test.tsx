import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TripCard } from "./trip-card";

const person = (n: number) => ({
  id: `u${n}`,
  spotId: `s${n}`,
  name: `Person ${n}`,
  image: null,
  isGuest: false,
  addedById: null,
  addedByName: null,
  hasLeft: false,
});

const trip = {
  id: "trip-1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  timeZone: "Asia/Manila",
  currency: "PHP",
  destination: null as string | null,
  members: [person(1), person(2), person(3)],
};

// 2027-03-01 at noon in Manila: the trip is 11 days away.
const now = new Date("2027-03-01T04:00:00Z");
const html = (overrides = {}) =>
  renderToStaticMarkup(<TripCard trip={{ ...trip, ...overrides }} now={now} />);

describe("TripCard", () => {
  it("is one link to the trip, with the name and the soft blue time tag", () => {
    const card = html();
    expect(card.match(/<a /g)).toHaveLength(1);
    expect(card).toContain('href="/trips/trip-1/schedule"');
    expect(card).toContain("Hội An long weekend");
    expect(card).toContain("In 11 days");
    expect(card).toContain("bg-blue-soft");
    expect(card).not.toContain("bg-amber");
  });

  it("says You + n, visibly, and nothing is hidden for screen readers only", () => {
    expect(html()).toContain("You + 2");
    expect(html({ members: [person(1), person(2)] })).toContain("You + 1");
    expect(html()).not.toContain("sr-only");
  });

  it("counts a guest and draws them in plain gray, keeping people's colors", () => {
    const guest = { ...person(2), id: "spot-2", isGuest: true, addedById: "u1", addedByName: "Person 1" };
    const card = html({ members: [person(1), guest] });
    expect(card).toContain("You + 1");
    expect(card.match(/bg-chip text-ink/g)).toHaveLength(1);
    expect(card.match(/text-on-face/g)).toHaveLength(1);
  });

  it("says Just you so far when alone", () => {
    const card = html({ members: [person(1)] });
    expect(card).toContain("Just you so far");
    expect(card).not.toContain("You +");
  });

  it("shows the destination only when there is one", () => {
    expect(html({ destination: "Hội An" })).toContain("Hội An</span>");
    expect(html()).not.toContain("<svg class=\"mt-0.5");
  });

  it("works out the time tag in the trip's own zone and for a finished trip", () => {
    // Already the 12th in Manila, still the 11th in UTC.
    expect(
      renderToStaticMarkup(<TripCard trip={trip} now={new Date("2027-03-11T17:00:00Z")} />),
    ).toContain("Day 1 of 4");
    expect(
      renderToStaticMarkup(<TripCard trip={trip} now={new Date("2027-04-01T00:00:00Z")} />),
    ).toContain("Trip&#x27;s over");
  });

  it("lets a long name wrap", () => {
    expect(html({ name: "A".repeat(80) })).toMatch(/<h2 class="[^"]*wrap-anywhere/);
  });

  it("shows the dates as a route line", () => {
    const card = html();
    expect(card).toContain("Mar 12");
    expect(card).toContain("Mar 15, 2027");
  });
});
