"use client";

import { useEffect } from "react";

// Renders nothing. Adds the homepage's motion (see "Homepage story" in globals.css):
// tickets fade up as they scroll into view and the plane rides the dashed line.
// With "reduce motion" on it does nothing, so the page shows as it is. The `story-js`
// class goes on only after everything already on screen is marked, so nothing flashes.
export function StoryMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const html = document.documentElement;
    const items = Array.from(document.querySelectorAll<HTMLElement>(".story-reveal"));
    const journey = document.querySelector<HTMLElement>(".story-journey");
    const plane = document.querySelector<HTMLElement>(".story-plane");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15 },
    );
    for (const item of items) {
      if (item.getBoundingClientRect().top < window.innerHeight) item.classList.add("in");
      else observer.observe(item);
    }
    html.classList.add("story-js");

    // The plane sits where 45% down the screen meets the journey, kept on the line.
    let frame = 0;
    const place = () => {
      frame = 0;
      if (!journey || !plane) return;
      const box = journey.getBoundingClientRect();
      const top = window.innerHeight * 0.45 - box.top;
      plane.style.top = `${Math.min(Math.max(top, 0), box.height - plane.offsetHeight)}px`;
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      html.classList.remove("story-js");
      plane?.style.removeProperty("top");
    };
  }, []);

  return null;
}
