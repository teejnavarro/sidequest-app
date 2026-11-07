import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getIdeaForMember } from "@/lib/ideas";
import { IdeaForm } from "@/components/idea-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; ideaId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only the person who added
// the idea, or the trip owner, gets here: anyone else sees the same "not found" as for an
// idea that does not exist.
async function EditIdeaContent({ params }: { params: Params }) {
  const { tripId, ideaId } = await params;
  const user = await getCurrentUser();
  const [trip, idea] = await Promise.all([
    getTripForMember(tripId, user.id),
    getIdeaForMember(tripId, ideaId, user.id),
  ]);
  if (!trip || !idea || !idea.canChange) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/ideas`} backLabel={trip.name} title="Edit idea" />
      <main className={screenClass}>
        <div className={`${cardClass} gap-4`}>
          <IdeaForm
            mode="edit"
            tripId={trip.id}
            ideaId={idea.id}
            currency={trip.currency}
            values={{
              name: idea.name,
              type: idea.type,
              duration: idea.duration,
              link: idea.link ?? "",
              area: idea.area ?? "",
              costPerPerson: idea.costPerPerson === null ? "" : String(idea.costPerPerson),
              notes: idea.notes ?? "",
            }}
          />
        </div>
        <Link
          href={`/trips/${trip.id}/ideas/${idea.id}/delete`}
          className={`${linkClass} justify-self-start text-owe`}
        >
          Delete idea
        </Link>
      </main>
    </>
  );
}

function EditIdeaLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-[640px] ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Edit idea | Sidequest" };

export default function EditIdeaPage({
  params,
}: PageProps<"/trips/[tripId]/ideas/[ideaId]/edit">) {
  return (
    <Suspense fallback={<EditIdeaLoading />}>
      <EditIdeaContent params={params} />
    </Suspense>
  );
}
