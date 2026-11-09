import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getScheduleItemForMember } from "@/lib/schedule";
import { RemoveItemForm } from "@/components/remove-item-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; itemId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only new items can be
// deleted; an idea item goes back to Approved from the Move page instead, so it sees the same
// "not found" as an item that does not exist.
async function DeleteItemContent({ params }: { params: Params }) {
  const { tripId, itemId } = await params;
  const user = await getCurrentUser();
  const [trip, item] = await Promise.all([
    getTripForMember(tripId, user.id),
    getScheduleItemForMember(tripId, itemId, user.id),
  ]);
  if (!trip || !item || item.fromIdea) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel="Schedule" title="Delete item" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
          <h2 id="delete-title" className="text-[19px] wrap-anywhere">
            Delete {item.name}?
          </h2>
          <p>This deletes it for good. You can&apos;t undo this.</p>
          <div className="grid gap-3">
            <Link
              href={`/trips/${trip.id}/schedule/${item.id}/edit`}
              className={`${primaryButton} w-full`}
            >
              Keep item
            </Link>
            <RemoveItemForm
              tripId={trip.id}
              itemId={item.id}
              label="Delete item"
              pendingLabel="Deleting…"
              danger
            />
          </div>
        </section>
      </main>
    </>
  );
}

function DeleteItemLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Delete item | Sidequest" };

export default function DeleteItemPage({
  params,
}: PageProps<"/trips/[tripId]/schedule/[itemId]/delete">) {
  return (
    <Suspense fallback={<DeleteItemLoading />}>
      <DeleteItemContent params={params} />
    </Suspense>
  );
}
