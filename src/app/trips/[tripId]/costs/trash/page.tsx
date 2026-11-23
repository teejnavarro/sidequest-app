import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { listTrashForMember, type TrashItem } from "@/lib/costs";
import { formatMoney } from "@/lib/money";
import { dayTimeLabel } from "@/lib/schedule-options";
import { CostCategoryIcon } from "@/components/cost-category";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, screenClass, skeleton } from "@/components/ui";
import { RestoreCostForm } from "./restore-form";

export const metadata: Metadata = { title: "Trash | Sidequest" };

// One deleted cost: what it was, the amount, who deleted it and when (on the trip's clock),
// and a Restore button.
function TrashRow({ item, tripId, timeZone }: { item: TrashItem; tripId: string; timeZone: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0">
      <span className="row-span-3 grid size-10 place-items-center rounded-full bg-blue-soft text-blue-text">
        <CostCategoryIcon category={item.category} />
      </span>
      <span className="text-[15px] font-bold wrap-anywhere">{item.description}</span>
      <span className="grid justify-items-end tabular-nums">
        <span className="text-[15px] font-bold">{formatMoney(item.amount, item.currency)}</span>
        {item.original ? (
          <span className="text-xs text-muted">{formatMoney(item.original.amount, item.original.currency)}</span>
        ) : null}
      </span>
      <span className="col-span-2 text-[13px] text-muted wrap-anywhere">
        Deleted by {item.deletedByYou ? "you" : item.deletedBy} · {dayTimeLabel(item.deletedAt, timeZone)}
      </span>
      <div className="col-span-2">
        <RestoreCostForm tripId={tripId} costId={item.id} />
      </div>
    </li>
  );
}

// This page sits outside the trip layout, so it checks for itself that the person is in the
// trip. The list is read through the privacy layer too, which hands a stranger nothing.
async function TrashContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const items = await listTrashForMember(tripId, user.id);

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel="Costs" title="Trash" />
      <main className={screenClass}>
        {items.length === 0 ? (
          <section className={`${cardClass} gap-3 px-5 py-6`}>
            <p className="font-display text-[19px] font-bold">Nothing in the trash.</p>
            <p>Deleted costs land here, so a wrong tap is never final.</p>
          </section>
        ) : (
          <section aria-label="Deleted costs" className={`${cardClass} gap-0 py-3`}>
            <p className="pb-1.5 text-[13px] text-muted">
              Deleted costs don&apos;t count in balances. Anyone in the trip can put one back.
            </p>
            <ul>
              {items.map((item) => (
                <TrashRow key={item.id} item={item} tripId={trip.id} timeZone={trip.timeZone} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function TrashLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`${cardClass} gap-4`}>
          {[0, 1].map((n) => (
            <div key={n} className="flex gap-3">
              <div className={`size-10 ${skeleton} rounded-full bg-chip`} />
              <div className="grid flex-1 gap-2">
                <div className={`h-4 w-2/3 ${skeleton} rounded-full bg-chip`} />
                <div className={`h-3 w-3/4 ${skeleton} rounded-full bg-chip`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function TrashPage({ params }: PageProps<"/trips/[tripId]/costs/trash">) {
  return (
    <Suspense fallback={<TrashLoading />}>
      <TrashContent params={params} />
    </Suspense>
  );
}
