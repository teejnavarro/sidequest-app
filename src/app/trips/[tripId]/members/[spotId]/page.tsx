import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CrownSimple } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { firstNameOf } from "@/lib/display-name";
import { getMemberForOwner, getTripForMember } from "@/lib/trips";
import { Face } from "@/components/face";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, linkClass, quietButton, screenClass, skeleton } from "@/components/ui";

type Params = Promise<{ tripId: string; spotId: string }>;

// This page sits outside the trip layout, so it checks for itself. Only the trip owner gets
// here, and only for another person still in the trip: anyone else, a guest, the owner's own
// row and a person who already left all see the same "not found".
async function MemberContent({ params }: { params: Params }) {
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
      <TaskBand backHref={`/trips/${trip.id}/invite#people`} backLabel="Invite people" title={member.name} />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-label={member.name}>
          <div className="flex min-w-0 items-center gap-4">
            <Face userId={member.userId} name={member.name} image={member.image} size={56} />
            <span className="grid min-w-0 flex-1">
              <span className="text-[19px] font-bold wrap-anywhere">{member.name}</span>
              {member.costCount > 0 ? (
                <span className={helpClass}>
                  Part of {member.costCount} {member.costCount === 1 ? "cost" : "costs"}
                </span>
              ) : null}
            </span>
          </div>
          <Link href={`/trips/${trip.id}/members/${member.spotId}/owner`} className={`${quietButton} w-full`}>
            <CrownSimple size={20} weight="bold" aria-hidden="true" />
            <span className="min-w-0 truncate">Make {first} the owner</span>
          </Link>
        </section>
        <Link
          href={`/trips/${trip.id}/members/${member.spotId}/remove`}
          className={`${linkClass} justify-self-start text-owe`}
        >
          Remove from trip
        </Link>
      </main>
    </>
  );
}

function MemberLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-48 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Member | Sidequest" };

export default function MemberPage({ params }: PageProps<"/trips/[tripId]/members/[spotId]">) {
  return (
    <Suspense fallback={<MemberLoading />}>
      <MemberContent params={params} />
    </Suspense>
  );
}
