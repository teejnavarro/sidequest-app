import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { transferOwnershipAction } from "../../actions";
import { getCurrentUser } from "@/lib/current-user";
import { firstNameOf } from "@/lib/display-name";
import { getMemberForOwner, getTripForMember } from "@/lib/trips";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; spotId: string }>;

// Same checks as the Member page: only the owner, only for another person still in the trip.
async function MakeOwnerContent({ params }: { params: Params }) {
  const { tripId, spotId } = await params;
  const user = await getCurrentUser();
  const [trip, member] = await Promise.all([
    getTripForMember(tripId, user.id),
    getMemberForOwner(tripId, spotId, user.id),
  ]);
  if (!trip || !member) notFound();

  const first = firstNameOf(member.name);
  const back = `/trips/${trip.id}/members/${member.spotId}`;

  return (
    <>
      <TaskBand backHref={back} backLabel={member.name} title="Make owner" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="owner-title">
          <h2 id="owner-title" className="text-[19px] wrap-anywhere">
            Make {first} the owner?
          </h2>
          <p className="wrap-anywhere">
            {first} will manage people, the invite link and deleting the trip. You stay in the trip as a
            member. Only {first} can hand it back.
          </p>
          <div className="grid gap-3">
            <ConfirmForm
              action={transferOwnershipAction}
              fields={{ tripId: trip.id, spotId: member.spotId }}
              label={`Make ${first} the owner`}
              pendingLabel="Making owner…"
              tone="primary"
            />
            <Link href={back} className={`${linkClass} justify-self-center`}>
              Go back
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function MakeOwnerLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Make owner | Sidequest" };

export default function MakeOwnerPage({
  params,
}: PageProps<"/trips/[tripId]/members/[spotId]/owner">) {
  return (
    <Suspense fallback={<MakeOwnerLoading />}>
      <MakeOwnerContent params={params} />
    </Suspense>
  );
}
