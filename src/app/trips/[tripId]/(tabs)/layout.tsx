import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft, MapPin, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { formatTripRange, todayInZone, tripTimeLabel } from "@/lib/trip-dates";
import { timeZoneLabel, timeZoneOffset } from "@/lib/trip-options";
import { Band } from "@/components/band";
import { FaceStack } from "@/components/face-stack";
import { TripTabs } from "@/components/trip-tabs";
import { amberTag, linkClass, skeleton } from "@/components/ui";

// Checks the person belongs to this trip before showing the trip's header and tabs.
// This does not protect the pages inside: Next.js can run them and send their data
// even when this check fails. Any page that shows trip data must check for itself.
async function TripShell({
  params,
  children,
}: {
  params: Promise<{ tripId: string }>;
  children: React.ReactNode;
}) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const [trip, members] = await Promise.all([
    getTripForMember(tripId, user.id),
    listTripMembers(tripId, user.id),
  ]);
  if (!trip) notFound();

  const range = formatTripRange(trip.startDate, trip.endDate);
  // Beside a destination only the offset is shown. Without one, the place name comes too.
  // A zone we don't know shows as its raw name, as timeZoneLabel gives it.
  const zone = trip.destination
    ? (timeZoneOffset(trip.timeZone, trip.startDate) ?? timeZoneLabel(trip.timeZone, trip.startDate))
    : timeZoneLabel(trip.timeZone, trip.startDate);
  // "Today" is the trip's own day, so it is worked out in the trip's time zone.
  const timeTag = tripTimeLabel(
    trip.startDate,
    trip.endDate,
    todayInZone(trip.timeZone, new Date()),
  );
  const going = members.length > 1 ? `${members.length} going` : "Just you so far";

  return (
    <div className="flex flex-1 flex-col">
      <div className="md:order-[-2]">
        <Band>
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/trips"
              className={`${linkClass} text-band-muted! no-underline focus-visible:outline-on-band`}
            >
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
              My trips
            </Link>
            <Link
              href={`/trips/${trip.id}/edit`}
              aria-label="Edit trip"
              className="inline-flex size-11 items-center justify-center rounded-full text-band-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
            >
              <PencilSimple size={20} weight="bold" aria-hidden="true" />
            </Link>
          </div>
          <h1 className="text-[30px] wrap-anywhere">{trip.name}</h1>
          <p className="flex items-start gap-1.5 text-[15px] text-band-muted">
            {trip.destination ? (
              <MapPin size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
            ) : null}
            <span className="min-w-0 wrap-anywhere">
              {trip.destination ? `${trip.destination} · ${range} · ${zone}` : `${range} · ${zone}`}
            </span>
          </p>
          <p className="mt-1 justify-self-start">
            <span className={amberTag}>{timeTag}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-band-muted">
              <FaceStack people={members} size={32} borderClass="border-band" />
              <span>{going}</span>
            </span>
            <Link
              href={`/trips/${trip.id}/invite`}
              className="inline-flex min-h-11 items-center rounded-full bg-on-band/15 px-4 text-sm font-bold text-on-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
            >
              Invite people
            </Link>
          </div>
        </Band>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <TripTabs tripId={trip.id} />
    </div>
  );
}

// Same shape as the real header and tab bar, so nothing jumps when the trip arrives.
function TripShellLoading() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col">
      <div className="bg-band md:order-[-2]">
        <div className="mx-auto grid max-w-[480px] gap-3 px-4 pt-5 pb-5 md:max-w-[640px]">
          <div className={`h-11 w-24 ${skeleton} rounded-full bg-on-band/20`} />
          <div className={`h-9 w-56 ${skeleton} rounded-full bg-on-band/20`} />
          <div className={`h-5 w-64 max-w-full ${skeleton} rounded-full bg-on-band/20`} />
          <div className={`h-6 w-24 ${skeleton} rounded-full bg-on-band/20`} />
          <div className="flex items-center justify-between gap-3">
            <div className={`h-8 w-40 ${skeleton} rounded-full bg-on-band/20`} />
            <div className={`h-11 w-32 ${skeleton} rounded-full bg-on-band/20`} />
          </div>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[480px] flex-1 content-start gap-4 px-4 pt-4 md:max-w-[640px]">
        <div className={`h-32 ${skeleton} rounded-card bg-chip`} />
      </div>
      <div className="sticky bottom-0 h-[58px] border-t border-line bg-card md:static md:order-[-1] md:mx-auto md:mt-3 md:w-[calc(100%-32px)] md:max-w-[640px] md:rounded-full md:border" />
    </div>
  );
}

export default function TripLayout({
  params,
  children,
}: LayoutProps<"/trips/[tripId]">) {
  return (
    <Suspense fallback={<TripShellLoading />}>
      <TripShell params={params}>{children}</TripShell>
    </Suspense>
  );
}
