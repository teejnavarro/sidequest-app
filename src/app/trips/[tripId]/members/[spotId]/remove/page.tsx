import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeMemberAction } from "../../actions";
import { getCurrentUser } from "@/lib/current-user";
import { firstNameOf } from "@/lib/display-name";
import { getMemberForOwner, getTripForMember } from "@/lib/trips";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, primaryButton, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; spotId: string }>;

// Same checks as the Member page: only the owner, only for another person still in the trip.
async function RemoveMemberContent({ params }: { params: Params }) {
  const { tripId, spotId } = await params;
  const user = await getCurrentUser();
  const [trip, member] = await Promise.all([
    getTripForMember(tripId, user.id),
    getMemberForOwner(tripId, spotId, user.id),
  ]);
  if (!trip || !member) notFound();

  const first = firstNameOf(member.name);

  return (
    <>
      <TaskBand
        backHref={`/trips/${trip.id}/members/${member.spotId}`}
        backLabel={member.name}
        title="Remove member"
      />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="remove-title">
          <h2 id="remove-title" className="text-[19px] wrap-anywhere">
            Remove {first} from the trip?
          </h2>
          <p className="wrap-anywhere">
            {first} won&apos;t see this trip anymore. Costs {first} is part of stay, marked &quot;left the
            trip&quot;.
          </p>
          <p className={`${helpClass} wrap-anywhere`}>
            {first} could rejoin with the invite link. Get a new link afterwards if you don&apos;t want that.
          </p>
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/members/${member.spotId}`} className={`${primaryButton} w-full`}>
              Keep {first}
            </Link>
            <ConfirmForm
              action={removeMemberAction}
              fields={{ tripId: trip.id, spotId: member.spotId }}
              label="Remove from trip"
              pendingLabel="Removing…"
              tone="danger"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function RemoveMemberLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-72 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Remove member | Sidequest" };

export default function RemoveMemberPage({
  params,
}: PageProps<"/trips/[tripId]/members/[spotId]/remove">) {
  return (
    <Suspense fallback={<RemoveMemberLoading />}>
      <RemoveMemberContent params={params} />
    </Suspense>
  );
}
