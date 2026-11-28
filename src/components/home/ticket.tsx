import type { ReactNode } from "react";

// A boarding pass: two parts split by a dashed tear line with a half-circle notch at each end.
// The words part comes first; the tear line is horizontal on a phone and vertical from md:.
// `overflow-hidden` on the card cuts each notch circle in half. The classes for the two
// parts (padding, and the width they take from md: or lg:) come from the caller.
// `from` is where the ticket lies sideways: md (768px) by default, lg (1024px) for tickets
// whose words need the room (the tear line then stays horizontal on tablets).
export function Ticket({
  main,
  side,
  mainClass,
  sideClass,
  className = "",
  from = "md",
}: {
  main: ReactNode;
  side: ReactNode;
  mainClass: string;
  sideClass: string;
  className?: string;
  from?: "md" | "lg";
}) {
  const sideways = from === "lg";
  const notch = "absolute size-4 rounded-full border border-line bg-bg";
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-card border border-line bg-card ${sideways ? "lg:flex-row" : "md:flex-row"} ${className}`}
    >
      <div className={`min-w-0 ${mainClass}`}>{main}</div>
      <div
        aria-hidden="true"
        className={`relative h-0 border-t-2 border-dashed border-line ${
          sideways
            ? "lg:h-auto lg:w-0 lg:border-t-0 lg:border-l-2"
            : "md:h-auto md:w-0 md:border-t-0 md:border-l-2"
        }`}
      >
        <i className={`${notch} -top-2 -left-2`} />
        <i
          className={`${notch} -top-2 -right-2 ${
            sideways
              ? "lg:top-auto lg:right-auto lg:-bottom-2 lg:-left-2"
              : "md:top-auto md:right-auto md:-bottom-2 md:-left-2"
          }`}
        />
      </div>
      <div className={`min-w-0 ${sideClass}`}>{side}</div>
    </div>
  );
}
