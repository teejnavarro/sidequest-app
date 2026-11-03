import Link from "next/link";
import { cardClass, primaryButton, screenClass } from "@/components/ui";

// The same words for a wrong-shaped link and a made-up code, so nobody learns which
// codes are real.
export default function JoinNotFound() {
  return (
    <main className={screenClass}>
      <div className={`${cardClass} gap-3 px-5 py-6`}>
        <h1 className="text-[19px]">This invite link isn&apos;t working</h1>
        <p className="text-[13px] text-muted">
          The link may be wrong or incomplete. Ask the person who sent it to share it again.
        </p>
        <Link href="/" className={`${primaryButton} w-full`}>
          Go to Sidequest
        </Link>
      </div>
    </main>
  );
}
