import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScheduleForm } from "./schedule-form";
import { emptyScheduleValues } from "@/lib/schedule-form-state";
import { tripDays } from "@/lib/schedule-options";

vi.mock("@/app/trips/[tripId]/schedule/actions", () => ({
  addToScheduleAction: async () => ({ errors: {}, values: {} }),
  moveScheduleItemAction: async () => ({ errors: {}, values: {} }),
}));

const days = tripDays("2027-05-08", "2027-05-10");
const ideas = [
  { id: "idea-1", name: "Phở Hòa Pasteur", type: "food" },
  { id: "idea-2", name: "War Remnants Museum", type: "sightseeing" },
];

const add = (kind: "idea" | "new", values = {}, list = ideas, place: string | null = "Vietnam") =>
  renderToStaticMarkup(
    <ScheduleForm
      mode="add"
      kind={kind}
      tripId="trip-1"
      days={days}
      place={place}
      ideas={list}
      values={{ ...emptyScheduleValues, kind, ...values }}
    />,
  );

describe("ScheduleForm", () => {
  it("keeps every field name the server reads, plus the trip id and the kind", () => {
    const html = add("new");
    for (const name of ["name", "notes", "day", "slot", "time", "tripId", "kind"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain('name="kind" value="new"');
    expect(html).not.toContain('name="ideaId"');
    expect(html).not.toContain('name="itemId"');
  });

  it("lists the approved ideas as radio choices for an idea, with no name or notes box", () => {
    const html = add("idea", { ideaId: "idea-2" });
    expect(html).toContain("Pick an approved idea");
    expect(html).toContain('name="ideaId" value="idea-1"');
    expect(html).toContain('checked="" value="idea-2"');
    expect(html).toContain("Phở Hòa Pasteur");
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('name="notes"');
  });

  it("says so, with a link to the Ideas tab, when no ideas are approved", () => {
    const html = add("idea", {}, []);
    expect(html).toContain("No approved ideas yet. Approve some on the Ideas tab.");
    expect(html).toContain('href="/trips/trip-1/ideas"');
    expect(html).not.toContain("<form");
  });

  it("offers a day chip for every trip day and the five choices for when", () => {
    const html = add("new");
    expect(html).toContain("Which day?");
    for (const short of ["Sat 8", "Sun 9", "Mon 10"]) expect(html).toContain(`>${short}<`);
    expect(html).toContain('name="day" value="2027-05-09"');
    expect(html).toContain("When?");
    for (const label of ["Full day", "Morning", "Afternoon", "Evening", "Exact time"]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("labels the time box with the place's clock, and works without a place", () => {
    expect(add("new")).toContain("Time (Vietnam time)");
    const html = add("new", {}, ideas, null);
    expect(html).toContain(">Time<");
    expect(html).not.toContain("(null time)");
  });

  it("shows the time box only when Exact time is chosen, by CSS, so it works without JavaScript", () => {
    const html = add("new", { slot: "time", time: "19:30" });
    expect(html).toMatch(/class="hidden group-has-\[[^"]*checked\]:grid"/);
    expect(html).toContain('type="time"');
    expect(html).toContain('value="19:30"');
  });

  it("names the main button for a picked day, and plainly before one is", () => {
    expect(add("new")).toContain(">Add to schedule<");
    expect(add("new", { day: "2027-05-09" })).toContain("Add to Sun, May 9");
  });

  it("keeps the typed name and notes", () => {
    const html = add("new", { name: "Airport transfer", notes: "Meet at arrivals." });
    expect(html).toContain('value="Airport transfer"');
    expect(html).toContain("Meet at arrivals.");
  });

  it("moves an item: carries its id, says Save changes, and keeps what it had", () => {
    const html = renderToStaticMarkup(
      <ScheduleForm
        mode="move"
        kind="new"
        tripId="trip-1"
        itemId="item-1"
        days={days}
        place="Vietnam"
        values={{ ...emptyScheduleValues, kind: "new", name: "Airport transfer", day: "2027-05-10", slot: "morning" }}
      />,
    );
    expect(html).toContain('name="itemId" value="item-1"');
    expect(html).toContain(">Save changes<");
    expect(html).toContain('checked="" value="2027-05-10"');
    expect(html).toContain('checked="" value="morning"');
  });

  it("picks no day for an item whose day is no longer in the trip", () => {
    const html = renderToStaticMarkup(
      <ScheduleForm
        mode="move"
        kind="new"
        tripId="trip-1"
        itemId="item-1"
        days={days}
        place="Vietnam"
        values={{ ...emptyScheduleValues, kind: "new", name: "Airport transfer", day: "2027-05-20", slot: "morning" }}
      />,
    );
    expect(html).not.toContain("2027-05-20");
    for (const { day } of days) expect(html).not.toContain(`checked="" value="${day}"`);
    expect(html).toContain(`value="${days[0].day}"`);
    expect(html).toContain('checked="" value="morning"');
  });

  it("moves an idea item with no name or notes box", () => {
    const html = renderToStaticMarkup(
      <ScheduleForm
        mode="move"
        kind="idea"
        tripId="trip-1"
        itemId="item-1"
        days={days}
        place="Vietnam"
        values={{ ...emptyScheduleValues, kind: "idea", day: "2027-05-10", slot: "full" }}
      />,
    );
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('name="notes"');
    expect(html).toContain('name="kind" value="idea"');
  });
});
