import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { listApprovedUnscheduled } from "@/lib/schedule";
import { tripDays } from "@/lib/schedule-options";
import { emptyScheduleValues } from "@/lib/schedule-form-state";
import { timeZonePlace } from "@/lib/trip-options";
import { ScheduleForm } from "@/components/schedule-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, focusRing, screenClass, skeleton } from "@/components/ui";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// The two ways to add are real links (?from=idea and ?from=new), drawn as one round switch.
function KindSwitch({ tripId, kind }: { tripId: string; kind: "idea" | "new" }) {
  const base = `/trips/${tripId}/schedule/add`;
  const item = (selected: boolean) =>
    `grid min-h-11 place-items-center rounded-full text-sm font-bold ${focusRing} ${
      selected ? "bg-card text-ink" : "text-muted"
    }`;
  return (
    <nav aria-label="What are you adding?" className="grid grid-cols-2 rounded-full bg-chip p-1">
      <Link href={`${base}?from=idea`} aria-current={kind === "idea" ? "page" : undefined} className={item(kind === "idea")}>
        Approved idea
      </Link>
      <Link href={`${base}?from=new`} aria-current={kind === "new" ? "page" : undefined} className={item(kind === "new")}>
        Something new
      </Link>
    </nav>
  );
}

// This page sits outside the trip layout, so it checks for itself that the person is in the
// trip, and reads its data inside its own Suspense boundary. ?idea=<id> picks an approved
// idea ("Schedule it" on the Ideas tab); an id that isn't an approved, unscheduled idea of
// this trip is ignored.
async function AddToScheduleContent({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: SearchParams;
}) {
  const { tripId } = await params;
  const { from, idea: ideaParam } = await searchParams;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const ideas = await listApprovedUnscheduled(tripId, user.id);
  const picked = typeof ideaParam === "string" && ideas.some((idea) => idea.id === ideaParam) ? ideaParam : "";
  // With no ?from= or ?idea= in the address, start on Approved idea only when there is one to
  // pick, otherwise on Something new. Both stay one tap away on the switch.
  const asked = from === "idea" || from === "new" || ideaParam !== undefined;
  const kind = picked || (asked ? from !== "new" : ideas.length > 0) ? "idea" : "new";

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel="Schedule" title="Add to schedule" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-5`}>
          <KindSwitch tripId={trip.id} kind={kind} />
          <ScheduleForm
            key={kind}
            mode="add"
            kind={kind}
            tripId={trip.id}
            ideas={ideas}
            days={tripDays(trip.startDate, trip.endDate)}
            place={timeZonePlace(trip.timeZone)}
            values={{ ...emptyScheduleValues, kind, ideaId: picked }}
          />
        </div>
      </main>
    </>
  );
}

function AddToScheduleLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[640px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Add to schedule | Sidequest" };

export default function AddToSchedulePage({
  params,
  searchParams,
}: PageProps<"/trips/[tripId]/schedule/add">) {
  return (
    <Suspense fallback={<AddToScheduleLoading />}>
      <AddToScheduleContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
