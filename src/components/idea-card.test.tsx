import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IdeaCard } from "./idea-card";

vi.mock("@/app/trips/[tripId]/ideas/actions", () => ({
  voteAction: async () => ({ error: "unused" }),
  approveAction: async () => {},
  moveBackAction: async () => {},
}));

const base = {
  id: "idea-1",
  name: "Phở Hòa Pasteur",
  type: "food",
  duration: "short",
  link: null as string | null,
  area: null as string | null,
  costPerPerson: null as number | null,
  costCurrency: null as string | null,
  notes: null as string | null,
  createdAt: new Date("2027-01-01T00:00:00Z"),
  addedBy: { id: "u2", name: "Ben Reyes", image: null },
  up: 0,
  down: 0,
  myVote: null as 1 | -1 | null,
  approvedAt: null as Date | null,
  approvedBy: null as { id: string; name: string } | null,
};

const html = (idea = {}, canChange = false) =>
  renderToStaticMarkup(<IdeaCard idea={{ ...base, ...idea }} tripId="trip-1" canChange={canChange} />);

describe("IdeaCard", () => {
  it("shows the name exactly, the type, the duration and who added it", () => {
    const card = html();
    expect(card).toContain("Phở Hòa Pasteur");
    expect(card).toContain(">Food<");
    expect(card).toContain("1–2 hrs");
    expect(card).toContain("Added by Ben");
  });

  it("lets a long name wrap in the Added by line instead of widening the page", () => {
    expect(html()).toMatch(/<p class="[^"]*\[overflow-wrap:anywhere\][^"]*">.*Added by Ben/);
  });

  it("shows the cost as 'about ... each' in the trip's currency, only when there is one", () => {
    expect(html({ costPerPerson: 120, costCurrency: "PHP" })).toContain("about ₱120 each");
    expect(html()).not.toContain("about");
  });

  it("shows the area only when there is one", () => {
    expect(html({ area: "District 3" })).toContain("District 3");
    expect(html()).not.toContain("District");
  });

  it("has nothing to open when there are no notes, no link and no Edit", () => {
    expect(html()).not.toContain("<details");
  });

  it("says Notes and link when there are notes or a link, and More when only Edit applies", () => {
    expect(html({ notes: "Cash only." })).toContain("Notes and link");
    expect(html({ link: "https://example.com" })).toContain("Notes and link");
    const onlyEdit = html({}, true);
    expect(onlyEdit).toContain(">More");
    expect(onlyEdit).not.toContain("Notes and link");
  });

  it("keeps line breaks in notes and lets long words wrap", () => {
    const card = html({ notes: "Line one\nLine two" });
    expect(card).toContain("Line one\nLine two");
    expect(card).toContain("whitespace-pre-line");
    expect(card).toContain("[overflow-wrap:anywhere]");
  });

  it("shows Edit idea only when the person may change it", () => {
    expect(html({}, true)).toContain('href="/trips/trip-1/ideas/idea-1/edit"');
    expect(html({}, false)).not.toContain("Edit idea");
  });

  it("does not show the adder's full name or any email", () => {
    const card = html();
    expect(card).not.toContain("Reyes");
    expect(card).not.toContain("@");
  });

  it("shows the vote buttons with the counts and the person's own vote", () => {
    const card = html({ up: 3, down: 1, myVote: 1 });
    expect(card).toContain('aria-label="Thumbs up, 3 votes"');
    expect(card).toContain('aria-label="Thumbs down, 1 vote"');
    expect(card).toMatch(/aria-pressed="true"[^>]*aria-label="Thumbs up|aria-label="Thumbs up[^>]*aria-pressed="true"/);
  });

  it("offers Approve on an idea that is not approved, with the ids the action reads", () => {
    const card = html();
    expect(card).toContain("Approve");
    expect(card).not.toContain("Move back");
    expect(card).not.toContain("Approved by");
    expect(card).toContain('name="tripId" value="trip-1"');
    expect(card).toContain('name="ideaId" value="idea-1"');
    expect(card).not.toContain("border-blue-text");
    // A message area for the vote and one for Approve, both read out politely.
    expect(card.match(/aria-live="polite"/g)).toHaveLength(2);
  });

  it("shows an approved idea with 'Approved by' the first name, a blue edge and Move back", () => {
    const card = html({ approvedAt: new Date(), approvedBy: { id: "u3", name: "Bea Santos" } });
    expect(card).toContain("Approved by Bea");
    expect(card).not.toContain("Santos");
    expect(card).toContain("Move back");
    expect(card).not.toContain(">Approve<");
    expect(card).toContain("border-blue-text");
  });

  it("offers Schedule it, pre-picking the idea, only on an approved idea", () => {
    const approved = html({ approvedAt: new Date() });
    expect(approved).toMatch(/href="\/trips\/trip-1\/schedule\/add\?idea=idea-1"[^>]*>[^]*Schedule it/);
    expect(approved.indexOf("Schedule it")).toBeLessThan(approved.indexOf("Move back"));
    expect(html()).not.toContain("Schedule it");
  });

  it("still shows an approved idea if the approver is unknown", () => {
    expect(html({ approvedAt: new Date() })).toContain(">Approved<");
  });
});
