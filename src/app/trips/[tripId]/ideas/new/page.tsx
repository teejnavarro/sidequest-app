import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { emptyIdeaValues } from "@/lib/idea-form-state";
import { IdeaForm } from "@/components/idea-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself that the person is in the
// trip, and reads its data inside its own Suspense boundary.
async function AddIdeaContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/ideas`} backLabel={trip.name} title="Add an idea" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <IdeaForm mode="create" tripId={trip.id} currency={trip.currency} values={emptyIdeaValues} />
        </div>
      </main>
    </>
  );
}

function AddIdeaLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[640px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Add an idea | Sidequest" };

export default function AddIdeaPage({ params }: PageProps<"/trips/[tripId]/ideas/new">) {
  return (
    <Suspense fallback={<AddIdeaLoading />}>
      <AddIdeaContent params={params} />
    </Suspense>
  );
}
