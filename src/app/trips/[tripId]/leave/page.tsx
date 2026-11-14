import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveTripAction } from "@/app/trips/actions";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, primaryButton, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself. Members get here; the owner
// can't leave (they hand the trip over first), so the owner and a stranger see "not found".
async function LeaveTripContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip || trip.ownerId === user.id) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/edit`} backLabel="Edit trip" title="Leave trip" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="leave-title">
          <h2 id="leave-title" className="text-[19px] wrap-anywhere">
            Leave {trip.name}?
          </h2>
          <p>
            You won&apos;t see this trip anymore. Costs you&apos;re part of stay, marked &quot;left the
            trip&quot;.
          </p>
          <p className={helpClass}>To come back, you&apos;ll need the invite link.</p>
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/edit`} className={`${primaryButton} w-full`}>
              Stay in trip
            </Link>
            <ConfirmForm
              action={leaveTripAction}
              fields={{ tripId: trip.id }}
              label="Leave trip"
              pendingLabel="Leaving…"
              tone="danger"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function LeaveTripLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Leave trip | Sidequest" };

export default function LeaveTripPage({ params }: PageProps<"/trips/[tripId]/leave">) {
  return (
    <Suspense fallback={<LeaveTripLoading />}>
      <LeaveTripContent params={params} />
    </Suspense>
  );
}
