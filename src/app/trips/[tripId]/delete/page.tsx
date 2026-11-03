import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember, listTripMembers } from "@/lib/trips";
import { cardClass, primaryButton, screenClass } from "@/components/ui";
import { DeleteForm } from "./delete-form";

// The layout's check does not protect this page, so it checks for itself. Only the owner
// gets here: a member or a stranger sees the same "not found" as for a missing trip.
export default async function DeleteTripPage({
  params,
}: PageProps<"/trips/[tripId]/delete">) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip || trip.ownerId !== user.id) notFound();

  const members = await listTripMembers(tripId, user.id);
  const count = members.length;

  return (
    <main className={`${screenClass} flex-1`}>
      <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-[19px] break-words">
          Delete {trip.name}?
        </h2>
        <p>
          {count > 1
            ? `This removes it for everyone in the trip, ${count} people, and can't be undone.`
            : "This removes it for good, and can't be undone."}
        </p>
        <div className="grid gap-3">
          <Link href={`/trips/${trip.id}/edit`} className={`${primaryButton} w-full`}>
            Keep trip
          </Link>
          <DeleteForm tripId={trip.id} />
        </div>
      </section>
    </main>
  );
}
