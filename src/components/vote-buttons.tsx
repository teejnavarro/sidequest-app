"use client";

import { useState, useTransition } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { focusRing } from "@/components/ui";
import { voteAction, type VoteActionResult } from "@/app/trips/[tripId]/ideas/actions";

export type Votes = { up: number; down: number; myVote: 1 | -1 | null };
type Choice = "up" | "down";

const SAVE_FAILED = "Couldn't save your vote. Please try again.";

// What the card shows the moment a thumb is tapped: the same thumb again takes the vote back,
// the other thumb switches it, and no vote yet adds one. The server decides the real result.
export function applyVote(votes: Votes, choice: Choice): Votes {
  const value = choice === "up" ? 1 : -1;
  let { up, down } = votes;
  if (votes.myVote === 1) up -= 1;
  if (votes.myVote === -1) down -= 1;
  if (votes.myVote === value) return { up, down, myVote: null };
  if (value === 1) up += 1;
  else down += 1;
  return { up, down, myVote: value };
}

// Sends the vote. The server's counts win; if it fails, go back to what was shown before.
export async function saveVote(
  before: Votes,
  send: () => Promise<VoteActionResult>,
): Promise<{ votes: Votes; error: string }> {
  try {
    const result = await send();
    if ("error" in result) return { votes: before, error: result.error };
    return { votes: result, error: "" };
  } catch {
    return { votes: before, error: SAVE_FAILED };
  }
}

const base = `inline-flex min-h-11 min-w-14 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums ${focusRing}`;

function plural(count: number) {
  return `${count} ${count === 1 ? "vote" : "votes"}`;
}

// Thumbs up and down with their counts. The tap shows at once; the save follows. The list does
// not re-sort until the next visit, so the card never moves under the thumb.
export function VoteButtons({
  tripId,
  ideaId,
  initial,
}: {
  tripId: string;
  ideaId: string;
  initial: Votes;
}) {
  const [votes, setVotes] = useState(initial);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  function vote(choice: Choice) {
    const before = votes;
    setVotes(applyVote(before, choice));
    setError("");
    const form = new FormData();
    form.set("tripId", tripId);
    form.set("ideaId", ideaId);
    form.set("choice", choice);
    startSaving(async () => {
      const outcome = await saveVote(before, () => voteAction(form));
      setVotes(outcome.votes);
      setError(outcome.error);
    });
  }

  const button = (choice: Choice) => {
    const up = choice === "up";
    const chosen = votes.myVote === (up ? 1 : -1);
    const count = up ? votes.up : votes.down;
    const Icon = up ? ThumbsUp : ThumbsDown;
    return (
      <button
        type="button"
        onClick={() => vote(choice)}
        disabled={saving}
        aria-pressed={chosen}
        aria-label={`Thumbs ${choice}, ${plural(count)}`}
        className={`${base} ${chosen ? "bg-blue-soft text-blue-text" : "bg-chip text-ink"}`}
      >
        <Icon size={18} weight={chosen ? "fill" : "bold"} aria-hidden="true" />
        {count}
      </button>
    );
  };

  return (
    <div className="grid gap-1">
      <div className="flex gap-2">
        {button("up")}
        {button("down")}
      </div>
      <p aria-live="polite" className="text-[13px] font-bold text-owe empty:hidden">
        {error}
      </p>
    </div>
  );
}
