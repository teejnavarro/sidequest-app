import type { ReactNode } from "react";

// The ocean blue header. `lift` leaves room for the first card to overlap its bottom edge.
export function Band({
  children,
  lift = false,
}: {
  children: ReactNode;
  lift?: boolean;
}) {
  return (
    <header className="bg-band text-on-band">
      <div
        className={`mx-auto grid max-w-[480px] gap-1 px-4 pt-5 md:max-w-[640px] ${lift ? "pb-9" : "pb-5"}`}
      >
        {children}
      </div>
    </header>
  );
}
