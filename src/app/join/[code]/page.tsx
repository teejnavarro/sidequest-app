import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/current-user";
import { isInviteCode } from "@/lib/invite-code";
import { getTripByInviteCode, isTripMember } from "@/lib/trips";
import { screenClass, skeleton } from "@/components/ui";
import { JoinView } from "./join-view";

// Fixed text only: chat apps build link previews from this, and nothing about the trip
// (not even its name) may appear there.
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

  if (!user) return <JoinView invited={invited} code={lowerCode} signedIn={false} />;

  if (await isTripMember(invited.id, user.id)) redirect(`/trips/${invited.id}`);
  return <JoinView invited={invited} code={lowerCode} signedIn />;
}

function JoinLoading() {
  return (
    <div aria-hidden="true" className="grid gap-4 rounded-card border border-line bg-card px-5 py-6">
      <div className={`h-9 w-3/4 ${skeleton} rounded-full bg-chip`} />
      <div className={`h-4 w-1/2 ${skeleton} rounded-full bg-chip`} />
      <div className={`h-12 w-full ${skeleton} rounded-full bg-chip`} />
    </div>
  );
}

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className={screenClass}>
      <p className="font-display text-[19px] font-bold">Sidequest</p>
      <Suspense fallback={<JoinLoading />}>
        <JoinContent params={params} />
      </Suspense>
    </main>
  );
}
