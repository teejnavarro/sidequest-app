"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AirplaneTilt,
  CalendarBlank,
  Lightbulb,
  Receipt,
} from "@phosphor-icons/react";

const TABS = [
  { slug: "schedule", label: "Schedule", Icon: CalendarBlank },
  { slug: "ideas", label: "Ideas", Icon: Lightbulb },
  { slug: "bookings", label: "Bookings", Icon: AirplaneTilt },
  { slug: "costs", label: "Costs", Icon: Receipt },
] as const;

// Bottom bar on phones, a rounded bar under the title from 768px up.
// Every tab is a real link, so each one has its own address.
export function TripTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Trip sections"
      className="sticky bottom-0 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:static md:order-[-1] md:mx-auto md:mt-3 md:w-[calc(100%-32px)] md:max-w-[640px] md:rounded-full md:border md:p-1 md:pb-1"
    >
      {TABS.map(({ slug, label, Icon }) => {
        const href = `/trips/${tripId}/${slug}`;
        const current = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`grid min-h-[58px] content-center justify-items-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-text md:min-h-11 md:grid-flow-col md:gap-1.5 md:rounded-full md:text-sm ${
              current
                ? "font-bold text-blue-text md:bg-blue-soft"
                : "font-medium text-muted"
            }`}
          >
            <Icon size={22} weight={current ? "fill" : "bold"} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
