import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { applyVote, saveVote, VoteButtons, type Votes } from "./vote-buttons";

vi.mock("@/app/trips/[tripId]/ideas/actions", () => ({ voteAction: async () => ({ error: "unused" }) }));

const none: Votes = { up: 2, down: 1, myVote: null };

describe("applyVote (what shows the moment you tap)", () => {
  it("adds a vote", () => {
    expect(applyVote(none, "up")).toEqual({ up: 3, down: 1, myVote: 1 });
    expect(applyVote(none, "down")).toEqual({ up: 2, down: 2, myVote: -1 });
  });

  it("takes the vote back when the same thumb is tapped again", () => {
    expect(applyVote({ up: 3, down: 1, myVote: 1 }, "up")).toEqual(none);
    expect(applyVote({ up: 2, down: 2, myVote: -1 }, "down")).toEqual(none);
  });

  it("switches to the other thumb in one step", () => {
    expect(applyVote({ up: 3, down: 1, myVote: 1 }, "down")).toEqual({ up: 2, down: 2, myVote: -1 });
    expect(applyVote({ up: 2, down: 2, myVote: -1 }, "up")).toEqual({ up: 3, down: 1, myVote: 1 });
  });
});

describe("saveVote", () => {
  it("uses the counts the server sends back", async () => {
    const saved = { up: 5, down: 0, myVote: 1 as const };
    await expect(saveVote(none, async () => saved)).resolves.toEqual({ votes: saved, error: "" });
  });

  it("goes back to the earlier counts and shows the message when the server says no", async () => {
    await expect(
      saveVote(none, async () => ({ error: "Couldn't save your vote. Please try again." })),
    ).resolves.toEqual({ votes: none, error: "Couldn't save your vote. Please try again." });
  });

  it("does the same when the request itself fails", async () => {
    const failing = async () => {
      throw new Error("offline");
    };
    await expect(saveVote(none, failing)).resolves.toEqual({
      votes: none,
      error: "Couldn't save your vote. Please try again.",
    });
  });
});

describe("VoteButtons markup", () => {
  const html = (initial = none) =>
    renderToStaticMarkup(<VoteButtons tripId="t" ideaId="i" initial={initial} />);

  it("labels each button with its count and says which one is pressed", () => {
    const page = html({ up: 1, down: 0, myVote: 1 });
    expect(page).toContain('aria-label="Thumbs up, 1 vote"');
    expect(page).toContain('aria-label="Thumbs down, 0 votes"');
    expect(page.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(page.match(/aria-pressed="false"/g)).toHaveLength(1);
  });

  it("uses the filled thumb only for the chosen one, and the soft blue look", () => {
    expect(html({ up: 1, down: 0, myVote: 1 })).toContain("bg-blue-soft");
    expect(html()).not.toContain("bg-blue-soft");
  });

  it("is at least 44px tall, shows counts with equal-width digits, and has a polite message area", () => {
    const page = html();
    expect(page).toContain("min-h-11");
    expect(page).toContain("tabular-nums");
    expect(page).toContain('aria-live="polite"');
    expect(page).not.toContain("disabled");
  });
});
