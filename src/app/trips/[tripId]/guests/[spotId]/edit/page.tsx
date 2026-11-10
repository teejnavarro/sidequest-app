import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { firstNameOf } from "@/lib/display-name";
import { getGuestForEditor, getTripForMember } from "@/lib/trips";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";
import { EditGuestForm } from "./edit-guest-form";

type Params = Promise<{ tripId: string; spotId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only the person who added
// the guest, or the trip owner, gets here: anyone else (and a spot that is no longer a guest,
// or does not exist) sees the same "not found".
async function EditGuestContent({ params }: { params: Params }) {
  const { tripId, spotId } = await params;
  const user = await getCurrentUser();
  const [trip, guest] = await Promise.all([
    getTripForMember(tripId, user.id),
    getGuestForEditor(tripId, spotId, user.id),
  ]);
  if (!trip || !guest) notFound();

  const adder = firstNameOf(guest.addedByName);
  const who = guest.addedById === user.id ? "you" : adder;

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/invite#people`} backLabel="Invite people" title="Edit guest" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <p className={helpClass}>
            Added by {adder}. Only {who} or the trip owner can change this guest.
          </p>
          <EditGuestForm tripId={trip.id} spotId={guest.spotId} name={guest.name} />
        </div>
        <Link
          href={`/trips/${trip.id}/guests/${guest.spotId}/remove`}
          className={`${linkClass} justify-self-start text-owe`}
        >
          Remove guest
        </Link>
        <p className={helpClass}>A guest who&apos;s part of any costs can&apos;t be removed.</p>
      </main>
    </>
  );
}

function EditGuestLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Edit guest | Sidequest" };

export default function EditGuestPage({
  params,
}: PageProps<"/trips/[tripId]/guests/[spotId]/edit">) {
  return (
    <Suspense fallback={<EditGuestLoading />}>
      <EditGuestContent params={params} />
    </Suspense>
  );
}
