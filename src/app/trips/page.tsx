import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { Band } from "@/components/band";
import { Face } from "@/components/face";
import {
  cardClass,
  primaryButton,
  screenClass,
} from "@/components/ui";

async function TripsContent() {
  const user = await getCurrentUser();

  return (
    <>
      <Band lift>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[30px]">My trips</h1>
          <Link
            href="/profile"
            aria-label="Open your profile"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-band"
          >
            <Face userId={user.id} name={user.name} image={user.image} size={44} />
          </Link>
        </div>
      </Band>
      <main className={`${screenClass} -mt-5 pt-0`}>
        <div className={`${cardClass} gap-3 px-5 py-6`}>
          <h2 className="text-[19px]">Start your first trip</h2>
          <p className="text-[13px] text-muted">
            Add the dates, then send your group the invite link.
          </p>
          <Link href="/trips/new" className={`${primaryButton} w-full`}>
            <Plus size={20} weight="bold" aria-hidden="true" />
            New trip
          </Link>
        </div>
      </main>
    </>
  );
}

function TripsLoading() {
  return (
    <div aria-hidden="true">
      <div className="bg-band">
        <div className="mx-auto max-w-[480px] px-4 pt-5 pb-9 md:max-w-[640px]">
          <div className="h-9 w-32 animate-pulse rounded-full bg-on-band/20" />
        </div>
      </div>
      <div className={`${screenClass} -mt-5 pt-0`}>
        <div className="h-36 animate-pulse rounded-card bg-chip" />
      </div>
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={<TripsLoading />}>
      <TripsContent />
    </Suspense>
  );
}
