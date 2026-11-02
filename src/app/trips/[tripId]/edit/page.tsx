import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { TripForm } from "@/components/trip-form";
import { cardClass, screenClass } from "@/components/ui";

export default async function EditTripPage({
  params,
}: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  return (
    <main className={`${screenClass} flex-1`}>
      <h2 className="text-[19px]">Edit trip</h2>
      <div className={`${cardClass} gap-4`}>
        <TripForm
          mode="edit"
          tripId={trip.id}
          values={{
            name: trip.name,
            startDate: trip.startDate,
            endDate: trip.endDate,
            timeZone: trip.timeZone,
            currency: trip.currency,
          }}
        />
      </div>
    </main>
  );
}
