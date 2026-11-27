import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight, CheckCircle, Crown, Info, XCircle } from "@phosphor-icons/react/dist/ssr";
import { getAccountDeletionCheck, type DeletionCheck } from "@/lib/account";
import { getCurrentUserForPage } from "@/lib/current-user";
import { formatMoney } from "@/lib/money";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand } from "@/components/task-band";
import { cardClass, focusRing, primaryButton, screenClass, skeleton } from "@/components/ui";
import { deleteAccountAction } from "./actions";

// State A: a shared trip is still theirs. No delete button, so nothing to tap by mistake.
function HandOver({ trips }: { trips: DeletionCheck["handOver"] }) {
  return (
    <>
      <section className={`${cardClass} gap-3 px-5 py-4`} aria-labelledby="hand-over-title">
        <div>
          <h2 id="hand-over-title" className="text-[19px]">
            First, hand over your trips
          </h2>
          <p className="text-[13px] text-muted">
            Other people are in these trips, so someone needs to look after them. Make someone else the owner,
            then come back here.
          </p>
        </div>
        <ul>
          {trips.map((trip) => (
            <li key={trip.tripId} className="border-t border-line first:border-t-0">
              <Link
                href={`/trips/${trip.tripId}/invite`}
                className={`flex min-h-14 min-w-0 items-center gap-3 py-2 ${focusRing}`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-soft text-blue-text">
                  <Crown size={22} weight="bold" aria-hidden="true" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="text-[15px] font-bold wrap-anywhere">{trip.name}</span>
                  <span className="text-sm text-muted">
                    You + {trip.peopleCount - 1} · Make someone else the owner
                  </span>
                </span>
                <CaretRight size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-center text-[13px] text-muted">Delete my account opens once no trip is left here.</p>
    </>
  );
}

function GoesItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <XCircle size={22} weight="bold" aria-hidden="true" className="mt-px shrink-0 text-owe" />
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </li>
  );
}

// State B: nothing left to hand over. Same pattern as Delete trip: amber keeps, red deletes.
function Confirm({ check }: { check: DeletionCheck }) {
  return (
    <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
      <h2 id="delete-title" className="text-[19px]">
        Delete your account?
      </h2>
      <ul className="grid gap-2">
        <GoesItem>Your name, email and photo</GoesItem>
        <GoesItem>Your payment details and QR images</GoesItem>
        <GoesItem>Receipts you uploaded</GoesItem>
        {check.soloTrips.map((trip) => (
          <GoesItem key={trip.tripId}>
            <b>{trip.name}</b>, since only you are in it
            {trip.costCount > 0 ? ` (${trip.costCount} ${trip.costCount === 1 ? "cost" : "costs"})` : ""}
          </GoesItem>
        ))}
      </ul>
      <hr className="border-line" />
      <p className="flex items-start gap-2.5">
        <CheckCircle size={22} weight="bold" aria-hidden="true" className="mt-px shrink-0 text-blue-text" />
        <span>
          Costs and payments stay in your trips under &quot;Former member&quot;, so everyone&apos;s balances
          still add up.
        </span>
      </p>
      {check.owing.map((trip) => (
        <p
          key={trip.tripId}
          className="flex items-start gap-2 rounded-field bg-chip px-3 py-2.5 text-[13px] text-muted"
        >
          <Info size={18} weight="bold" aria-hidden="true" className="mt-px shrink-0 text-blue-text" />
          <span className="min-w-0 wrap-anywhere">
            You still owe {formatMoney(trip.amount, trip.currency)} in {trip.name}. That stays on the
            trip&apos;s balances.
          </span>
        </p>
      ))}
      <p className="text-[13px] text-muted">
        You can&apos;t undo this. Signing in again later starts a new, empty account.
      </p>
      <div className="grid gap-3">
        <Link href="/profile" className={`${primaryButton} w-full`}>
          Keep my account
        </Link>
        <ConfirmForm
          action={deleteAccountAction}
          fields={{}}
          label="Delete my account"
          pendingLabel="Deleting…"
          tone="danger"
        />
      </div>
    </section>
  );
}

// Inside the proxy matcher, but the real check is here: who is signed in, and what they
// still own, are read fresh on every visit.
async function DeleteAccountContent() {
  const user = await getCurrentUserForPage();
  const check = await getAccountDeletionCheck(user.id);
  return check.handOver.length > 0 ? <HandOver trips={check.handOver} /> : <Confirm check={check} />;
}

export const metadata: Metadata = { title: "Delete my account | Sidequest" };

export default function DeleteAccountPage() {
  return (
    <>
      <TaskBand backHref="/profile" backLabel="Profile" title="Delete my account" />
      <main className={screenClass}>
        <Suspense fallback={<div aria-hidden="true" className={`h-72 ${skeleton} rounded-card bg-chip`} />}>
          <DeleteAccountContent />
        </Suspense>
      </main>
    </>
  );
}
