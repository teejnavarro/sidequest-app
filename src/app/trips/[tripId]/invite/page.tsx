import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getInviteCodeForMember, getTripForMember, listTripMembers } from "@/lib/trips";
import { Face } from "@/components/face";
import { InviteActions } from "@/components/invite-actions";
import { cardClass, helpClass, screenClass } from "@/components/ui";

// The layout's check does not protect this page, so it checks membership itself.
export default async function InvitePage({
  params,
}: PageProps<"/trips/[tripId]/invite">) {
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

  return (
    <main className={`${screenClass} flex-1`}>
      <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="invite-title">
        <h2 id="invite-title" className="text-[19px]">
          Invite people
        </h2>
        <p className={helpClass}>
          Anyone with this link can join after signing in. Share it only with your group.
        </p>
        <p className="rounded-field border border-line bg-bg p-3 text-sm break-all select-all">
          {link}
        </p>
        <InviteActions url={link} tripName={trip.name} />
      </section>

      <section className={`${cardClass} gap-3 px-5 py-6`} aria-labelledby="members-title">
        <h2 id="members-title" className="text-[19px]">
          Who&apos;s in ({members.length})
        </h2>
        <ul className="grid gap-3">
          {members.map((member) => (
            <li key={member.id} className="flex min-w-0 items-center gap-3">
              <Face userId={member.id} name={member.name} image={member.image} size={40} />
              <span className="min-w-0 break-words">
                {member.name}
                {member.id === trip.ownerId ? (
                  <span className="text-muted"> (owner)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
