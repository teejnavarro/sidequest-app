import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { TripForm } from "@/components/trip-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself that the person is a
// member, and reads its data inside its own Suspense boundary.
async function EditTripContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel={trip.name} title="Edit trip" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <TripForm
            mode="edit"
            tripId={trip.id}
            values={{
              name: trip.name,
              startDate: trip.startDate,
              endDate: trip.endDate,
              timeZone: trip.timeZone,
              currency: trip.currency,
              destination: trip.destination ?? "",
            }}
          />
        </div>
        {trip.ownerId === user.id ? (
          <Link
            href={`/trips/${trip.id}/delete`}
            className={`${linkClass} justify-self-start text-owe`}
          >
            Delete trip
          </Link>
        ) : null}
      </main>
    </>
  );
}

function EditTripLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[560px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Edit trip | Sidequest" };

export default function EditTripPage({ params }: PageProps<"/trips/[tripId]/edit">) {
  return (
    <Suspense fallback={<EditTripLoading />}>
      <EditTripContent params={params} />
    </Suspense>
  );
}
