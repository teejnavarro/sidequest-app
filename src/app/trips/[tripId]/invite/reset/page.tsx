import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resetInviteLinkAction } from "../actions";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";

// This page sits outside the trip layout, so it checks for itself. Only the owner gets here: a
// member or a stranger sees the same "not found" as for a missing trip.
async function ResetLinkContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip || trip.ownerId !== user.id) notFound();

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/invite`} backLabel="Invite people" title="New invite link" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="reset-title">
          <h2 id="reset-title" className="text-[19px]">
            Get a new invite link?
          </h2>
          <p>The old link stops working right away. Anyone who hasn&apos;t joined yet will need the new one.</p>
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/invite`} className={`${primaryButton} w-full`}>
              Keep this link
            </Link>
            <ConfirmForm
              action={resetInviteLinkAction}
              fields={{ tripId: trip.id }}
              label="Get a new link"
              pendingLabel="Getting a new link…"
              tone="quiet"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function ResetLinkLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "New invite link | Sidequest" };

export default function ResetLinkPage({ params }: PageProps<"/trips/[tripId]/invite/reset">) {
  return (
    <Suspense fallback={<ResetLinkLoading />}>
      <ResetLinkContent params={params} />
    </Suspense>
  );
}
