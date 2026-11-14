import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { countCostsForTrip } from "@/lib/costs";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { DeleteForm } from "./delete-form";

// This page sits outside the trip layout, so it checks for itself, and reads its data
// inside its own Suspense boundary. Only the owner gets here: a member or a stranger sees
// the same "not found" as for a missing trip.
async function DeleteTripContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip || trip.ownerId !== user.id) notFound();

  const [members, costCount] = await Promise.all([
    listTripMembers(tripId, user.id),
    countCostsForTrip(tripId, user.id),
  ]);
  const count = members.length;

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel={trip.name} title="Delete trip" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
          <h2 id="delete-title" className="text-[19px] wrap-anywhere">
            Delete {trip.name}?
          </h2>
          <p>
            {count > 1
              ? `This deletes it for all ${count} people in the trip. You can't undo this.`
              : "This deletes it for good. You can't undo this."}
          </p>
          {costCount > 0 && (
            <p>This also deletes {costCount} {costCount === 1 ? "cost" : "costs"}.</p>
          )}
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/edit`} className={`${primaryButton} w-full`}>
              Keep trip
            </Link>
            <DeleteForm tripId={trip.id} />
          </div>
        </section>
      </main>
    </>
  );
}

function DeleteTripLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Delete trip | Sidequest" };

export default function DeleteTripPage({ params }: PageProps<"/trips/[tripId]/delete">) {
  return (
    <Suspense fallback={<DeleteTripLoading />}>
      <DeleteTripContent params={params} />
    </Suspense>
  );
}
