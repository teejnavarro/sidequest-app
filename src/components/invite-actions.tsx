"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, ShareNetwork } from "@phosphor-icons/react";
import { errorClass, helpClass, primaryButton, quietButton } from "@/components/ui";

const noSubscription = () => () => {};

// Share link is the main button where the phone can share. Elsewhere, Copy link is.
export function InviteActions({ url, tripName }: { url: string; tripName: string }) {
  // The server can't know if sharing exists, so ask the browser without a hydration mismatch.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
  const [message, setMessage] = useState<{ text: string; problem: boolean }>({
    text: "",
    problem: false,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ text: "Link copied", problem: false });
    } catch {
      setMessage({
        text: "Couldn't copy. Select the link above and copy it.",
        problem: true,
      });
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${tripName} on Sidequest`, url });
    } catch (error) {
      // Closing the share menu is not a problem.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage({ text: "Couldn't open sharing. Try Copy link instead.", problem: true });
    }
  }

  return (
    <div className="grid gap-3">
      {canShare ? (
        <button type="button" onClick={share} className={`${primaryButton} w-full`}>
          <ShareNetwork size={20} weight="bold" aria-hidden="true" />
          Share link
        </button>
      ) : null}
      <button
        type="button"
        onClick={copy}
        className={`${canShare ? quietButton : primaryButton} w-full`}
      >
        <Copy size={20} weight="bold" aria-hidden="true" />
        Copy link
      </button>
      <p aria-live="polite" className={`min-h-5 ${message.problem ? errorClass : helpClass}`}>
        {message.text}
      </p>
    </div>
  );
}
