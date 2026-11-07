import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getIdeaForMember } from "@/lib/ideas";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { DeleteIdeaForm } from "./delete-form";

type Params = Promise<{ tripId: string; ideaId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only the person who added
// the idea, or the trip owner, gets here: anyone else sees the same "not found" as for an
// idea that does not exist.
async function DeleteIdeaContent({ params }: { params: Params }) {
  const { tripId, ideaId } = await params;
  const user = await getCurrentUser();
  const [trip, idea] = await Promise.all([
    getTripForMember(tripId, user.id),
    getIdeaForMember(tripId, ideaId, user.id),
  ]);
  if (!trip || !idea || !idea.canChange) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/ideas`} backLabel={trip.name} title="Delete idea" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
          <h2 id="delete-title" className="text-[19px] [overflow-wrap:anywhere]">
            Delete {idea.name}?
          </h2>
          <p>This deletes it for good. You can&apos;t undo this.</p>
          <div className="grid gap-3">
            <Link
              href={`/trips/${trip.id}/ideas/${idea.id}/edit`}
              className={`${primaryButton} w-full`}
            >
              Keep idea
            </Link>
            <DeleteIdeaForm tripId={trip.id} ideaId={idea.id} />
          </div>
        </section>
      </main>
    </>
  );
}

function DeleteIdeaLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Delete idea | Sidequest" };

export default function DeleteIdeaPage({
  params,
}: PageProps<"/trips/[tripId]/ideas/[ideaId]/delete">) {
  return (
    <Suspense fallback={<DeleteIdeaLoading />}>
      <DeleteIdeaContent params={params} />
    </Suspense>
  );
}
