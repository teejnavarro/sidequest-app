import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Each page has its own fixed browser title. A trip's name must never be in one: titles
// can show up in history, shared screenshots and link previews.
const pages: [string, string][] = [
  ["src/app/trips/page.tsx", "My trips | Sidequest"],
  ["src/app/trips/new/page.tsx", "New trip | Sidequest"],
  ["src/app/profile/page.tsx", "Profile | Sidequest"],
  ["src/app/trips/[tripId]/(tabs)/schedule/page.tsx", "Schedule | Sidequest"],
  ["src/app/trips/[tripId]/(tabs)/ideas/page.tsx", "Ideas | Sidequest"],
  ["src/app/trips/[tripId]/(tabs)/bookings/page.tsx", "Bookings | Sidequest"],
  ["src/app/trips/[tripId]/(tabs)/costs/page.tsx", "Costs | Sidequest"],
  ["src/app/trips/[tripId]/edit/page.tsx", "Edit trip | Sidequest"],
  ["src/app/trips/[tripId]/invite/page.tsx", "Invite people | Sidequest"],
  ["src/app/trips/[tripId]/delete/page.tsx", "Delete trip | Sidequest"],
  ["src/app/join/[code]/page.tsx", "You're invited | Sidequest"],
];

describe("page titles", () => {
  it.each(pages)("%s has the fixed title %j", (file, title) => {
    const source = readFileSync(file, "utf8");
    expect(source).toContain(`title: "${title}"`);
  });

  it.each(pages)("%s has no generateMetadata, so no trip name can reach the title", (file) => {
    expect(readFileSync(file, "utf8")).not.toContain("generateMetadata");
  });
});
