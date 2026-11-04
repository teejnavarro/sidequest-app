import { GoogleLogo, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { InvitedTrip } from "@/lib/trips";
import { formatTripDates } from "@/lib/trip-dates";
import { FaceStack } from "@/components/face-stack";
import { RouteLine } from "@/components/route-line";
import { cardClass, primaryButton } from "@/components/ui";
import { signInToJoin } from "../actions";
import { JoinForm } from "./join-form";

// What a visitor sees for a valid invite. Signed out, only the owner's name appears as
// words: the other people are shown as decorative circles with no names or alt text.
export function JoinView({
  invited,
  code,
  signedIn,
}: {
  invited: InvitedTrip;
  code: string;
  signedIn: boolean;
}) {
  const dates = formatTripDates(invited.startDate, invited.endDate);
  const count = invited.members.length;

  return (
    <div className={`${cardClass} gap-4 px-5 py-6`}>
      <div className="grid gap-1">
        <h1 className="text-[30px] wrap-anywhere">You&apos;re invited to {invited.name}</h1>
        {invited.destination ? (
          <p className="text-[17px] flex items-start gap-1.5">
            <MapPin size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0" />
            <span className="min-w-0 wrap-anywhere">{invited.destination}</span>
          </p>
        ) : null}
      </div>

      <RouteLine start={dates.start} end={dates.end} />

      <div className="flex items-center gap-3">
        <FaceStack
          people={invited.members}
          size={36}
          borderClass="border-card"
          decorative={!signedIn}
        />
        <p className="text-[13px] text-muted">
          {count === 1 ? "1 person is going" : `${count} people are going`}
        </p>
      </div>

      <p className="text-[13px] wrap-anywhere text-muted">Trip owner: {invited.ownerName}</p>
      <p className="text-[13px] text-muted">
        Sidequest keeps your group&apos;s plans and shared costs in one place.
      </p>

      {signedIn ? (
        <JoinForm code={code} />
      ) : (
        <form action={signInToJoin}>
          <input type="hidden" name="code" value={code} />
          <button type="submit" className={`${primaryButton} w-full`}>
            <GoogleLogo size={20} weight="bold" aria-hidden="true" />
            Continue with Google
          </button>
          <p className="mt-3 text-center text-[13px] text-muted">
            You&apos;ll join the trip right after signing in.
          </p>
        </form>
      )}
    </div>
  );
}
