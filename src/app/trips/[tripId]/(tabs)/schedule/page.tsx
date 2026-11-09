import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { listScheduleForMember, type ScheduleListItem } from "@/lib/schedule";
import { tripDays, whenLabel } from "@/lib/schedule-options";
import { todayInZone } from "@/lib/trip-dates";
import { ScrollToToday } from "@/components/scroll-to-today";
import {
  cardClass,
  focusRing,
  primaryButton,
  screenClass,
  skeleton,
  softTag,
} from "@/components/ui";

export const metadata: Metadata = { title: "Schedule | Sidequest" };

// One row: when, what, and the quiet line under it. The whole row opens the Move page.
function ItemRow({ item, tripId }: { item: ScheduleListItem; tripId: string }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/trips/${tripId}/schedule/${item.id}/edit`}
        className={`grid min-h-11 grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2.5 ${focusRing}`}
      >
        <span className="text-[13px] font-bold text-blue-text tabular-nums">
          {whenLabel(item.slot, item.time)}
        </span>
        <span className="text-[15px] font-bold wrap-anywhere">{item.name}</span>
        <span className="col-start-2 text-xs text-muted wrap-anywhere">
          {item.fromIdea ? (
            <>
              <Lightbulb size={14} weight="bold" aria-hidden="true" className="mr-1 inline align-text-bottom" />
              From ideas ·{" "}
            </>
          ) : item.notes ? (
            <span className="block whitespace-pre-line">{item.notes}</span>
          ) : null}
          Last changed by {item.updatedBy.firstName}
        </span>
      </Link>
    </li>
  );
}

// A day's card. Today's card has a blue edge and a "Today" tag.
function DayCard({
  id,
  title,
  note,
  isToday = false,
  items,
  tripId,
}: {
  id?: string;
  title: string;
  note?: string;
  isToday?: boolean;
  items: ScheduleListItem[];
  tripId: string;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={`${cardClass} gap-1 ${isToday ? "border-2 border-blue-text" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px]">{title}</h2>
        {isToday ? <span className={softTag}>Today</span> : note ? <p className="text-[13px] text-muted">{note}</p> : null}
      </div>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} tripId={tripId} />
          ))}
        </ul>
      ) : (
        <p className="py-1 text-sm text-muted">Nothing planned yet.</p>
      )}
    </section>
  );
}

// This page sits inside the trip layout, but that check does not protect it: it checks that
// the person is in the trip for itself. "Today" is the trip's own day, worked out in the
// trip's time zone after the session is read.
async function ScheduleContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const items = await listScheduleForMember(tripId, user.id);
  const days = tripDays(trip.startDate, trip.endDate);
  const today = todayInZone(trip.timeZone, new Date());
  const todayIsTripDay = days.some((day) => day.day === today);
  const tripDaySet = new Set(days.map((day) => day.day));
  const needsNewDay = items.filter((item) => !tripDaySet.has(item.day));

  return (
    <main className={`${screenClass} flex-1`}>
      {days.map((day) => (
        <DayCard
          key={day.day}
          id={`day-${day.day}`}
          title={day.label}
          note={`Day ${day.number}`}
          isToday={day.day === today}
          items={items.filter((item) => item.day === day.day)}
          tripId={tripId}
        />
      ))}
      {needsNewDay.length > 0 ? <DayCard title="Needs a new day" items={needsNewDay} tripId={tripId} /> : null}

      <Link href={`/trips/${tripId}/schedule/add`} className={`${primaryButton} w-full`}>
        <CalendarPlus size={20} weight="bold" aria-hidden="true" />
        Add to schedule
      </Link>
      {todayIsTripDay ? <ScrollToToday day={today} /> : null}
    </main>
  );
}

function ScheduleLoading() {
  return (
    <div className={`${screenClass} flex-1`} aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <div key={n} className={`${cardClass} gap-3`}>
          <div className="flex items-baseline justify-between">
            <div className={`h-5 w-28 ${skeleton} rounded-full bg-chip`} />
            <div className={`h-4 w-12 ${skeleton} rounded-full bg-chip`} />
          </div>
          <div className={`h-4 w-2/3 ${skeleton} rounded-full bg-chip`} />
          <div className={`h-4 w-1/2 ${skeleton} rounded-full bg-chip`} />
        </div>
      ))}
      <div className={`h-12 ${skeleton} rounded-full bg-chip`} />
    </div>
  );
}

export default function SchedulePage({ params }: PageProps<"/trips/[tripId]/schedule">) {
  return (
    <Suspense fallback={<ScheduleLoading />}>
      <ScheduleContent params={params} />
    </Suspense>
  );
}
