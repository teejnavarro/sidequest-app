import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft, MapPin } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { formatTripRange } from "@/lib/trip-dates";
import { timeZoneLabel } from "@/lib/trip-options";
import { Band } from "@/components/band";
import { FaceStack } from "@/components/face-stack";
import { TripTabs } from "@/components/trip-tabs";
import { linkClass, skeleton } from "@/components/ui";

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

  const zone = timeZoneLabel(trip.timeZone, trip.startDate);

  return (
    <div className="flex flex-1 flex-col">
      <div className="md:order-[-2]">
        <Band>
          <Link
            href="/trips"
            className={`${linkClass} justify-self-start text-band-muted! no-underline focus-visible:outline-on-band`}
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
            My trips
          </Link>
          <h1 className="text-[30px]">{trip.name}</h1>
          {trip.destination ? (
            <p className="text-[15px] text-band-muted flex items-start gap-1.5">
              <MapPin size={18} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{trip.destination}</span>
            </p>
          ) : null}
          <p className="text-[13px] text-band-muted">
            {formatTripRange(trip.startDate, trip.endDate)} · {zone}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[13px] text-band-muted">
              <FaceStack people={members} size={32} borderClass="border-band" />
              <span className="min-w-0 break-words">
                Owner: <span className="font-bold text-on-band">{trip.ownerName}</span>
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              <Link
                href={`/trips/${trip.id}/invite`}
                className="inline-flex min-h-11 items-center rounded-full bg-on-band/15 px-4 text-sm font-bold text-on-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
              >
                Invite people
              </Link>
              <Link
                href={`/trips/${trip.id}/edit`}
                className="inline-flex min-h-11 items-center rounded-full bg-on-band/15 px-4 text-sm font-bold text-on-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
              >
                Edit trip
              </Link>
            </span>
          </div>
        </Band>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
      <TripTabs tripId={trip.id} />
    </div>
  );
}

function TripShellLoading() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col">
      <div className="bg-band">
        <div className="mx-auto grid max-w-[480px] gap-3 px-4 pt-5 pb-5 md:max-w-[640px]">
          <div className={`h-5 w-24 ${skeleton} rounded-full bg-on-band/20`} />
          <div className={`h-9 w-56 ${skeleton} rounded-full bg-on-band/20`} />
          <div className={`h-4 w-64 ${skeleton} rounded-full bg-on-band/20`} />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-[480px] gap-4 px-4 pt-4 md:max-w-[640px]">
        <div className={`h-32 ${skeleton} rounded-card bg-chip`} />
      </div>
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
