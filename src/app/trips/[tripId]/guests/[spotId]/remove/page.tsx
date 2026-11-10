import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getGuestForEditor, getTripForMember } from "@/lib/trips";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { RemoveGuestForm } from "./remove-guest-form";

type Params = Promise<{ tripId: string; spotId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only the person who added
// the guest, or the trip owner, gets here: anyone else sees the same "not found" as for a
// guest that does not exist or has already taken their spot.
async function RemoveGuestContent({ params }: { params: Params }) {
  const { tripId, spotId } = await params;
  const user = await getCurrentUser();
  const [trip, guest] = await Promise.all([
    getTripForMember(tripId, user.id),
    getGuestForEditor(tripId, spotId, user.id),
  ]);
  if (!trip || !guest) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/invite#people`} backLabel="Invite people" title="Remove guest" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="remove-title">
          <h2 id="remove-title" className="text-[19px] [overflow-wrap:anywhere]">
            Remove {guest.name}?
          </h2>
          <p>They&apos;ll be taken off this trip.</p>
          <div className="grid gap-3">
            <Link
              href={`/trips/${trip.id}/guests/${guest.spotId}/edit`}
              className={`${primaryButton} w-full`}
            >
              Keep guest
            </Link>
            <RemoveGuestForm tripId={trip.id} spotId={guest.spotId} />
          </div>
        </section>
      </main>
    </>
  );
}

function RemoveGuestLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Remove guest | Sidequest" };

export default function RemoveGuestPage({
  params,
}: PageProps<"/trips/[tripId]/guests/[spotId]/remove">) {
  return (
    <Suspense fallback={<RemoveGuestLoading />}>
      <RemoveGuestContent params={params} />
    </Suspense>
  );
}
