import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getScheduleItemForMember } from "@/lib/schedule";
import { tripDays } from "@/lib/schedule-options";
import { timeZonePlace } from "@/lib/trip-options";
import { IdeaTypeIcon } from "@/components/idea-type";
import { RemoveItemForm } from "@/components/remove-item-form";
import { ScheduleForm } from "@/components/schedule-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton, softTag } from "@/components/ui";

type Params = Promise<{ tripId: string; itemId: string }>;

// This page sits outside the trip layout, so it checks for itself. Anyone not in the trip
// sees the same "not found" as for an item that does not exist.
async function MoveItemContent({ params }: { params: Params }) {
  const { tripId, itemId } = await params;
  const user = await getCurrentUser();
  const [trip, item] = await Promise.all([
    getTripForMember(tripId, user.id),
    getScheduleItemForMember(tripId, itemId, user.id),
  ]);
  if (!trip || !item) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel="Schedule" title="Move item" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-5`}>
          {item.fromIdea ? (
            <div className="grid justify-items-start gap-2">
              <h2 className="text-[19px] wrap-anywhere">{item.name}</h2>
              <span className={`${softTag} gap-1`}>
                {item.ideaType ? <IdeaTypeIcon type={item.ideaType} size={14} /> : null}
                From ideas
              </span>
            </div>
          ) : null}
          <ScheduleForm
            mode="move"
            kind={item.fromIdea ? "idea" : "new"}
            tripId={trip.id}
            itemId={item.id}
            days={tripDays(trip.startDate, trip.endDate)}
            place={timeZonePlace(trip.timeZone)}
            values={{
              kind: item.fromIdea ? "idea" : "new",
              ideaId: item.ideaId ?? "",
              name: item.fromIdea ? "" : item.name,
              notes: item.notes ?? "",
              day: item.day,
              slot: item.slot,
              time: item.time ?? "",
            }}
          />
        </div>
        {item.fromIdea ? (
          <RemoveItemForm
            tripId={trip.id}
            itemId={item.id}
            label="Back to approved ideas"
            pendingLabel="Moving…"
          />
        ) : (
          <Link
            href={`/trips/${trip.id}/schedule/${item.id}/delete`}
            className={`${linkClass} justify-self-start text-owe`}
          >
            Delete item
          </Link>
        )}
      </main>
    </>
  );
}

function MoveItemLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[560px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Move item | Sidequest" };

export default function MoveItemPage({
  params,
}: PageProps<"/trips/[tripId]/schedule/[itemId]/edit">) {
  return (
    <Suspense fallback={<MoveItemLoading />}>
      <MoveItemContent params={params} />
    </Suspense>
  );
}
