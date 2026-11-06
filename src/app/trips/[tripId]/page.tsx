import { Suspense } from "react";
import { redirect } from "next/navigation";

// Reading `params` has to happen inside Suspense, now that no layout wraps this page.
async function GoToSchedule({
  params,
}: {
  params: Promise<{ tripId: string }>;
}): Promise<never> {
  const { tripId } = await params;
  redirect(`/trips/${tripId}/schedule`);
}

export default function TripPage({ params }: PageProps<"/trips/[tripId]">) {
  return (
    <Suspense fallback={null}>
      <GoToSchedule params={params} />
    </Suspense>
  );
}
