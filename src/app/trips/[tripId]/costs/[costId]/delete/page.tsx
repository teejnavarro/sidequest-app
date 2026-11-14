import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getCostForMember } from "@/lib/costs";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { DeleteCostForm } from "./delete-form";

type Params = Promise<{ tripId: string; costId: string }>;

// This page sits outside the trip layout, so it checks for itself. Any member may delete a
// cost; a stranger, and a cost that does not exist, see the same "not found".
async function DeleteCostContent({ params }: { params: Params }) {
  const { tripId, costId } = await params;
  const user = await getCurrentUser();
  const [trip, cost] = await Promise.all([
    getTripForMember(tripId, user.id),
    getCostForMember(tripId, costId, user.id),
  ]);
  if (!trip || !cost) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel={trip.name} title="Delete cost" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
          <h2 id="delete-title" className="text-[19px] wrap-anywhere">
            Delete {cost.description}?
          </h2>
          <p>This deletes it for everyone. You can&apos;t undo this.</p>
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/costs/${cost.id}/edit`} className={`${primaryButton} w-full`}>
              Keep cost
            </Link>
            <DeleteCostForm tripId={trip.id} costId={cost.id} />
          </div>
        </section>
      </main>
    </>
  );
}

function DeleteCostLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Delete cost | Sidequest" };

export default function DeleteCostPage({ params }: PageProps<"/trips/[tripId]/costs/[costId]/delete">) {
  return (
    <Suspense fallback={<DeleteCostLoading />}>
      <DeleteCostContent params={params} />
    </Suspense>
  );
}
