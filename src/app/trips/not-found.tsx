import Link from "next/link";
import { cardClass, primaryButton, screenClass } from "@/components/ui";

// Shown for a trip that does not exist AND for one that is not yours. The same
// words either way, so nobody can learn which trips exist.
export default function TripNotFound() {
  return (
    <main className={screenClass}>
      <div className={`${cardClass} gap-3 px-5 py-6`}>
        <h1 className="text-[19px]">We couldn&apos;t find that trip</h1>
        <p className="text-[13px] text-muted">
          It may have moved, or the link may be wrong. Your own trips are all on My trips.
        </p>
        <Link href="/trips" className={`${primaryButton} w-full`}>
          Go to My trips
        </Link>
      </div>
    </main>
  );
}
