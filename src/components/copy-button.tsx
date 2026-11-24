"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react/dist/ssr";
import { smallQuietButton } from "@/components/ui";

// A small quiet button that copies some text (the account number, digits only) and says
// "Copied" for two seconds. If the phone refuses the copy it says so instead of pretending.
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const Icon = state === "copied" ? Check : Copy;
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${label}`} className={`${smallQuietButton} shrink-0`}>
      <Icon size={18} weight="bold" aria-hidden="true" />
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy"}</span>
    </button>
  );
}
