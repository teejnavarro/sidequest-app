import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserForPage } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getPaymentForParty } from "@/lib/payments";
import { paymentSentence } from "@/lib/payment-input";
import { paymentTimeLabel } from "@/lib/payment-dates";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Payment | Sidequest" };

// This page sits outside the trip layout, so it checks for itself. Only the payer or the
// receiver (still in the trip) gets here: anyone else sees the same "not found" as for a
// payment that does not exist.
async function PaymentContent({ params }: { params: Promise<{ tripId: string; paymentId: string }> }) {
  const { tripId, paymentId } = await params;
  const user = await getCurrentUserForPage();
  const [trip, payment] = await Promise.all([
    getTripForMember(tripId, user.id),
    getPaymentForParty(tripId, paymentId, user.id),
  ]);
  if (!trip || !payment) notFound();

  const other = payment.from.isYou ? payment.to.name : payment.from.name;
  const sentence = paymentSentence({
    payerIsYou: payment.from.isYou,
    payerName: payment.from.name,
    receiverIsYou: payment.to.isYou,
    receiverName: payment.to.name,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
  });
  const receipt = `/trips/${trip.id}/costs/payments/${payment.id}/receipt`;

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs/balances`} backLabel="Balances" title="Payment" />
      <main className={screenClass}>
        <section className={`${cardClass} gap-3 px-5 py-4`}>
          <p className="text-[17px] font-bold wrap-anywhere">{sentence}</p>
          <p className={helpClass}>
            {paymentTimeLabel(payment.createdAt, trip.timeZone)} · Recorded by{" "}
            {payment.recordedByYou ? "you" : payment.recordedBy}
          </p>
          {payment.hasReceipt ? (
            <div className="grid gap-2">
              <a
                href={receipt}
                target="_blank"
                rel="noopener"
                className="justify-self-start rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text"
              >
                {/* The receipt is served by a route that checks who is asking; next/image would copy it through the optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receipt}
                  alt="Receipt screenshot"
                  className="max-h-80 max-w-full rounded-field border border-line bg-card object-contain"
                />
              </a>
              <p className={helpClass}>Only you and {other} can see this receipt.</p>
            </div>
          ) : null}
        </section>
        <Link
          href={`/trips/${trip.id}/costs/payments/${payment.id}/delete`}
          className={`${linkClass} justify-self-start text-owe`}
        >
          Delete payment
        </Link>
      </main>
    </>
  );
}

function PaymentLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-48 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function PaymentPage({ params }: PageProps<"/trips/[tripId]/costs/payments/[paymentId]">) {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PaymentContent params={params} />
    </Suspense>
  );
}
