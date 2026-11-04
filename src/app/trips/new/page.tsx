import { Suspense } from "react";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { emptyTripValues } from "@/lib/trip-form-state";
import { TripForm } from "@/components/trip-form";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";

async function NewTripContent() {
  await getCurrentUser(); // signed-out visitors go home
  return (
    <div className={`${cardClass} gap-4`}>
      <TripForm mode="create" values={emptyTripValues} />
    </div>
  );
}

export default function NewTripPage() {
  return (
    <main className={screenClass}>
      <Link href="/trips" className={`${linkClass} justify-self-start no-underline`}>
        <CaretLeft size={20} weight="bold" aria-hidden="true" />
        My trips
      </Link>
      <h1 className="text-[30px]">New trip</h1>
      <Suspense
        fallback={<div aria-hidden="true" className={`h-96 ${skeleton} rounded-card bg-chip`} />}
      >
        <NewTripContent />
      </Suspense>
    </main>
  );
}
