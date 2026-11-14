import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { TripForm } from "@/components/trip-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself that the person is a
// member, and reads its data inside its own Suspense boundary.
async function EditTripContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  // The owner can only leave after handing the trip to another person, so the hint about that
  // shows only when there is another person (guests can't own a trip).
  const isOwner = trip.ownerId === user.id;
  const hasOtherPerson = isOwner
    ? (await listTripMembers(tripId, user.id)).filter((member) => !member.isGuest).length > 1
    : false;

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
        {isOwner ? (
          <>
            <Link
              href={`/trips/${trip.id}/delete`}
              className={`${linkClass} justify-self-start text-owe`}
            >
              Delete trip
            </Link>
            {hasOtherPerson ? (
              <p className={helpClass}>
                To leave, make someone else the owner first. You can do that on{" "}
                <Link href={`/trips/${trip.id}/invite#people`} className="underline underline-offset-2">
                  Invite people
                </Link>
                .
              </p>
            ) : null}
          </>
        ) : (
          <Link
            href={`/trips/${trip.id}/leave`}
            className={`${linkClass} justify-self-start text-owe`}
          >
            Leave trip
          </Link>
        )}
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
