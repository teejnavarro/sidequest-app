import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { costPeople, defaultCostValues } from "@/lib/cost-form-state";
import { todayInZone } from "@/lib/trip-dates";
import { CostForm } from "@/components/cost-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself that the person is in the
// trip, and reads its data inside its own Suspense boundary. The cost's id is made here, after
// the session is read, so a double tap on Save sends the same id twice and saves once.
async function LogCostContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const people = costPeople(await listTripMembers(tripId, user.id), user.id);
  const values = defaultCostValues({
    people,
    today: todayInZone(trip.timeZone, new Date()),
    tripStart: trip.startDate,
  });

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel={trip.name} title="Log a cost" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <CostForm
            mode="new"
            tripId={trip.id}
            costId={crypto.randomUUID()}
            currency={trip.currency}
            people={people}
            values={values}
            updatedAt=""
          />
        </div>
      </main>
    </>
  );
}

function LogCostLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[640px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Log a cost | Sidequest" };

export default function LogCostPage({ params }: PageProps<"/trips/[tripId]/costs/new">) {
  return (
    <Suspense fallback={<LogCostLoading />}>
      <LogCostContent params={params} />
    </Suspense>
  );
}
