import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { listMyTrips } from "@/lib/trips";
import { formatTripDates } from "@/lib/trip-dates";
import { Band } from "@/components/band";
import { Face } from "@/components/face";
import { FaceStack } from "@/components/face-stack";
import { RouteLine } from "@/components/route-line";
import { cardClass, pressCard, primaryButton, screenClass } from "@/components/ui";

async function TripsContent() {
  const user = await getCurrentUser();
  const trips = await listMyTrips(user.id);

  return (
    <>
      <Band lift>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px]">My trips</h1>
          <Link
            href="/profile"
            aria-label="Open your profile"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
          >
            <Face userId={user.id} name={user.name} image={user.image} size={44} />
          </Link>
        </div>
      </Band>
      <main className={`${screenClass} -mt-5 pt-0`}>
        {trips.length === 0 ? (
          <div className={`${cardClass} gap-3 px-5 py-6`}>
            <h2 className="text-[19px]">Start your first trip</h2>
            <p className="text-[13px] text-muted">
              Add the dates, then send your group the invite link.
            </p>
            <Link href="/trips/new" className={`${primaryButton} w-full`}>
              <Plus size={20} weight="bold" aria-hidden="true" />
              New trip
            </Link>
          </div>
        ) : (
          <>
            {trips.map((trip) => {
              const dates = formatTripDates(trip.startDate, trip.endDate);
              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className={`${cardClass} ${pressCard}`}
                >
                  <h2 className="text-[19px] break-words">{trip.name}</h2>
                  {trip.destination ? (
                    <p className="text-[13px] break-words text-muted">{trip.destination}</p>
                  ) : null}
                  <RouteLine start={dates.start} end={dates.end} />
                  <span className="flex items-center justify-between gap-3">
                    <FaceStack
                      people={trip.members}
                      size={32}
                      borderClass="border-card"
                      decorative
                    />
                    <span className="sr-only">
                      {trip.members.length === 1 ? "1 person" : `${trip.members.length} people`}
                    </span>
                  </span>
                </Link>
              );
            })}
            <Link href="/trips/new" className={`${primaryButton} w-full`}>
              <Plus size={20} weight="bold" aria-hidden="true" />
              New trip
            </Link>
          </>
        )}
      </main>
    </>
  );
}

function TripsLoading() {
  return (
    <div aria-hidden="true">
      <div className="bg-band">
        <div className="mx-auto max-w-[480px] px-4 pt-5 pb-9 md:max-w-[640px]">
          <div className="h-9 w-32 animate-pulse rounded-full bg-on-band/20" />
        </div>
      </div>
      <div className={`${screenClass} -mt-5 pt-0`}>
        <div className="h-24 animate-pulse rounded-card bg-chip" />
        <div className="h-24 animate-pulse rounded-card bg-chip" />
      </div>
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<TripsLoading />}>
      <TripsContent />
    </Suspense>
  );
}
