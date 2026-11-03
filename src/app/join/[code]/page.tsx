import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { getOptionalUser } from "@/lib/current-user";
import { isInviteCode } from "@/lib/invite-code";
import { formatTripDates } from "@/lib/trip-dates";
import { getTripByInviteCode, isTripMember } from "@/lib/trips";
import { RouteLine } from "@/components/route-line";
import { cardClass, primaryButton, screenClass } from "@/components/ui";
import { signInToJoin } from "../actions";
import { JoinForm } from "./join-form";

// Fixed text only: chat apps build link previews from this, and the trip name must
// never appear there.
export const metadata: Metadata = {
  title: "You're invited | Sidequest",
  robots: { index: false, follow: false },
};

async function JoinContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isInviteCode(code)) notFound();
  const invited = await getTripByInviteCode(code);
  if (!invited) notFound();

  const user = await getOptionalUser();
  const lowerCode = code.toLowerCase();

  // Signed out: only the trip name and the owner's name. No dates, photos or members.
  if (!user) {
    return (
      <div className={`${cardClass} gap-4 px-5 py-6`}>
        <div className="grid gap-1">
          <h1 className="text-[30px] break-words">You&apos;re invited to {invited.name}</h1>
          <p className="text-[13px] text-muted">Trip owner: {invited.ownerName}</p>
        </div>
        <form action={signInToJoin}>
          <input type="hidden" name="code" value={lowerCode} />
          <button type="submit" className={`${primaryButton} w-full`}>
            <GoogleLogo size={20} weight="bold" aria-hidden="true" />
            Continue with Google
          </button>
        </form>
      </div>
    );
  }

  if (await isTripMember(invited.id, user.id)) redirect(`/trips/${invited.id}`);

  const dates = formatTripDates(invited.startDate, invited.endDate);
  return (
    <div className={`${cardClass} gap-4 px-5 py-6`}>
      <div className="grid gap-1">
        <h1 className="text-[30px] break-words">{invited.name}</h1>
        <p className="text-[13px] text-muted">Trip owner: {invited.ownerName}</p>
      </div>
      <RouteLine start={dates.start} end={dates.end} />
      <JoinForm code={lowerCode} />
    </div>
  );
}

function JoinLoading() {
  return (
    <div aria-hidden="true" className="grid gap-4 rounded-card border border-line bg-card px-5 py-6">
      <div className="h-9 w-3/4 animate-pulse rounded-full bg-chip" />
      <div className="h-4 w-1/2 animate-pulse rounded-full bg-chip" />
      <div className="h-12 w-full animate-pulse rounded-full bg-chip" />
    </div>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className={screenClass}>
      <Suspense fallback={<JoinLoading />}>
        <JoinContent params={params} />
      </Suspense>
    </main>
  );
}
