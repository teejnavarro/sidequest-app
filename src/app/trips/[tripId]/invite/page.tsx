import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getInviteCodeForMember, getTripForMember, listTripMembers } from "@/lib/trips";
import { firstNameOf } from "@/lib/display-name";
import type { TripMemberSummary } from "@/lib/trips";
import { AddGuestForm } from "@/components/add-guest-form";
import { Face } from "@/components/face";
import { InviteActions } from "@/components/invite-actions";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, guestTag, helpClass, screenClass, skeleton, softTag } from "@/components/ui";

// One row of the people list: the face, the name, a quiet "Added by" line and a Guest tag
// for guests, the Owner tag for the owner. A guest's row is a link to Edit guest only for
// the person who added them and for the trip owner.
function PersonRow({
  member,
  tripId,
  ownerId,
  viewerId,
}: {
  member: TripMemberSummary;
  tripId: string;
  ownerId: string;
  viewerId: string;
}) {
  const canEdit = member.isGuest && (member.addedById === viewerId || ownerId === viewerId);
  const content = (
    <>
      <Face userId={member.id} name={member.name} image={member.image} size={40} neutral={member.isGuest} />
      <span className="grid min-w-0 flex-1">
        <span className="min-w-0 wrap-anywhere">{member.name}</span>
        {member.isGuest && member.addedByName ? (
          <span className={`${helpClass} wrap-anywhere`}>Added by {firstNameOf(member.addedByName)}</span>
        ) : null}
      </span>
      {member.isGuest ? <span className={guestTag}>Guest</span> : null}
      {member.id === ownerId ? <span className={softTag}>Owner</span> : null}
      {canEdit ? (
        <CaretRight size={20} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
      ) : null}
    </>
  );
  const row = "flex min-h-11 min-w-0 items-center gap-3";
  return (
    <li>
      {canEdit ? (
        <Link
          href={`/trips/${tripId}/guests/${member.spotId}/edit`}
          aria-label={`Edit guest ${member.name}`}
          className={`${row} -mx-2 rounded-field px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text`}
        >
          {content}
        </Link>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}

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
      <TaskBand backHref={`/trips/${trip.id}/schedule`} backLabel={trip.name} title="Invite people" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-label="Invite link">
          <p className={helpClass}>
            Anyone with this link can join after signing in. Share it only with your group.
          </p>
          {/* One shortened line. The whole link is still in the page, and is what Copy and Share send. */}
          <p className="truncate text-sm text-muted select-all">{link}</p>
          <InviteActions url={link} tripName={trip.name} />
        </section>

        <section id="people" className={`${cardClass} gap-3 px-5 py-6`} aria-labelledby="members-title">
          <h2 id="members-title" className="text-[19px]">
            {count === 1 ? "1 person is in" : `${count} people are in`}
          </h2>
          <ul className="grid gap-3">
            {members.map((member) => (
              <PersonRow
                key={member.spotId}
                member={member}
                tripId={trip.id}
                ownerId={trip.ownerId}
                viewerId={user.id}
              />
            ))}
          </ul>
          <AddGuestForm tripId={trip.id} />
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

export const metadata: Metadata = { title: "Invite people | Sidequest" };

export default function InvitePage({ params }: PageProps<"/trips/[tripId]/invite">) {
  return (
    <Suspense fallback={<InviteLoading />}>
      <InviteContent params={params} />
    </Suspense>
  );
}
