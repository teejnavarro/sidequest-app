import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { getCostForMember } from "@/lib/costs";
import { costPeople, valuesFromCost } from "@/lib/cost-form-state";
import { amountText } from "@/lib/money";
import { CostForm } from "@/components/cost-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; costId: string }>;

// This page sits outside the trip layout, so it checks for itself. Any member may edit a
// cost; a stranger, and a cost that does not exist or belongs to another trip, see the same
// "not found".
async function EditCostContent({ params }: { params: Params }) {
  const { tripId, costId } = await params;
  const user = await getCurrentUser();
  const [trip, cost] = await Promise.all([
    getTripForMember(tripId, user.id),
    getCostForMember(tripId, costId, user.id),
  ]);
  if (!trip || !cost) notFound();

  const people = costPeople(await listTripMembers(tripId, user.id), user.id);

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel={trip.name} title="Edit cost" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <CostForm
            mode="edit"
            tripId={trip.id}
            costId={cost.id}
            currency={cost.currency}
            people={people}
            values={valuesFromCost(cost, amountText(cost.amount, cost.currency))}
            updatedAt={cost.updatedAt.toISOString()}
          />
        </div>
        <Link href={`/trips/${trip.id}/costs/${cost.id}/delete`} className={`${linkClass} justify-self-start text-owe`}>
          Delete cost
        </Link>
      </main>
    </>
  );
}

function EditCostLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[640px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Edit cost | Sidequest" };

export default function EditCostPage({ params }: PageProps<"/trips/[tripId]/costs/[costId]/edit">) {
  return (
    <Suspense fallback={<EditCostLoading />}>
      <EditCostContent params={params} />
    </Suspense>
  );
}
