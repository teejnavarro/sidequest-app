import Link from "next/link";
import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { formatTripDates, todayInZone, tripTimeLabel } from "@/lib/trip-dates";
import type { TripListItem } from "@/lib/trips";
import { FaceStack } from "@/components/face-stack";
import { RouteLine } from "@/components/route-line";
import { cardClass, pressCard, softTag } from "@/components/ui";

// One trip: name and time tag, destination, the dates as a route, and who is going.
// The whole card is one link.
export function TripCard({ trip, now }: { trip: TripListItem; now: Date }) {
  const dates = formatTripDates(trip.startDate, trip.endDate);
  // "Today" is the trip's own day, so it is worked out in the trip's time zone.
  const timeTag = tripTimeLabel(trip.startDate, trip.endDate, todayInZone(trip.timeZone, now));
  const others = trip.members.length - 1;

  return (
    <Link href={`/trips/${trip.id}/schedule`} className={`${cardClass} ${pressCard}`}>
      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 className="min-w-0 text-[19px] wrap-anywhere">{trip.name}</h2>
        <span className={softTag}>{timeTag}</span>
      </span>
      {trip.destination ? (
        <p className="flex items-start gap-1.5 text-[13px] text-muted">
          <MapPin size={16} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
          <span className="min-w-0 wrap-anywhere">{trip.destination}</span>
        </p>
      ) : null}
      <RouteLine start={dates.start} end={dates.end} />
      <span className="flex items-center gap-3">
        <FaceStack people={trip.members} size={32} borderClass="border-card" decorative />
        <span className="text-[13px] text-muted">
          {others > 0 ? `You + ${others}` : "Just you so far"}
        </span>
      </span>
    </Link>
  );
}
