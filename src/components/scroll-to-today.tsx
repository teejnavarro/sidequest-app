"use client";

import { useEffect } from "react";

// Brings today's card into view the first time the Schedule tab opens. Draws nothing. A day
// in the address (#day-2027-05-09) wins, so coming back from Add or Move lands on that day.
// Phones set to reduce motion jump instead of gliding.
export function ScrollToToday({ day }: { day: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`day-${day}`)
      ?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
  }, [day]);

  return null;
}
