import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { emptyTripValues } from "@/lib/trip-form-state";
import { TripForm } from "@/components/trip-form";
import { TaskBand } from "@/components/task-band";
import { cardClass, screenClass, skeleton } from "@/components/ui";

async function NewTripContent() {
  await getCurrentUser(); // signed-out visitors go home
  return (
    <div className={`${cardClass} gap-4`}>
      <TripForm mode="create" values={emptyTripValues} />
    </div>
  );
}

export default function NewTripPage() {
  return (
    <>
      <TaskBand backHref="/trips" backLabel="My trips" title="New trip" />
      <main className={screenClass}>
        <Suspense
          fallback={<div aria-hidden="true" className={`h-96 ${skeleton} rounded-card bg-chip`} />}
        >
          <NewTripContent />
        </Suspense>
      </main>
    </>
  );
}
