import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getInviteCodeForMember, getTripForMember, listTripMembers } from "@/lib/trips";
import { Face } from "@/components/face";
import { InviteActions } from "@/components/invite-actions";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, screenClass, skeleton, softTag } from "@/components/ui";

// This page sits outside the trip layout, so it checks membership itself, and reads its
// data inside its own Suspense boundary.
async function InviteContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();

  const code = await getInviteCodeForMember(tripId, user.id);
  if (!code) notFound();
  const [trip, members] = await Promise.all([
    getTripForMember(tripId, user.id),
    listTripMembers(tripId, user.id),
  ]);
  if (!trip) notFound();

  const path = `/join/${code}`;
  const base = process.env.BETTER_AUTH_URL;
  const link = base ? new URL(path, base).toString() : path;
  const count = members.length;

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}`} backLabel={trip.name} title="Invite people" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-label="Invite link">
          <p className={helpClass}>
            Anyone with this link can join after signing in. Share it only with your group.
          </p>
          {/* One shortened line. The whole link is still in the page, and is what Copy and Share send. */}
          <p className="truncate text-sm text-muted select-all">{link}</p>
          <InviteActions url={link} tripName={trip.name} />
        </section>

        <section className={`${cardClass} gap-3 px-5 py-6`} aria-labelledby="members-title">
          <h2 id="members-title" className="text-[19px]">
            {count === 1 ? "1 person is in" : `${count} people are in`}
          </h2>
          <ul className="grid gap-3">
            {members.map((member) => (
              <li key={member.id} className="flex min-w-0 items-center gap-3">
                <Face userId={member.id} name={member.name} image={member.image} size={40} />
                <span className="min-w-0 break-words">{member.name}</span>
                {member.id === trip.ownerId ? <span className={softTag}>Owner</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function InviteLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-52 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-40 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function InvitePage({ params }: PageProps<"/trips/[tripId]/invite">) {
  return (
    <Suspense fallback={<InviteLoading />}>
      <InviteContent params={params} />
    </Suspense>
  );
}
