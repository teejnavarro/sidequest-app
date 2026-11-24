import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getPaymentForParty } from "@/lib/payments";
import { paymentSentence } from "@/lib/payment-input";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { deletePaymentAction } from "../../actions";

export const metadata: Metadata = { title: "Delete payment | Sidequest" };

// Same rule as the payment page: only the payer or the receiver gets here.
async function DeletePaymentContent({ params }: { params: Promise<{ tripId: string; paymentId: string }> }) {
  const { tripId, paymentId } = await params;
  const user = await getCurrentUser();
  const [trip, payment] = await Promise.all([
    getTripForMember(tripId, user.id),
    getPaymentForParty(tripId, paymentId, user.id),
  ]);
  if (!trip || !payment) notFound();

  const sentence = paymentSentence({
    payerIsYou: payment.from.isYou,
    payerName: payment.from.name,
    receiverIsYou: payment.to.isYou,
    receiverName: payment.to.name,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
  });

  return (
    <>
      <TaskBand
        backHref={`/trips/${trip.id}/costs/payments/${payment.id}`}
        backLabel="Payment"
        title="Delete payment?"
      />
      <main className={screenClass}>
        <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
          <h2 id="delete-title" className="text-[19px] wrap-anywhere">
            Delete &ldquo;{sentence.replace(/\.$/, "")}&rdquo;?
          </h2>
          <p>
            Balances go back to before it, for everyone.
            {payment.hasReceipt ? " The receipt is deleted too." : ""} You can&apos;t undo this.
          </p>
          <div className="grid gap-3">
            <Link href={`/trips/${trip.id}/costs/payments/${payment.id}`} className={`${primaryButton} w-full`}>
              Keep payment
            </Link>
            <ConfirmForm
              action={deletePaymentAction}
              fields={{ tripId: trip.id, paymentId: payment.id }}
              label="Delete payment"
              pendingLabel="Deleting…"
              tone="danger"
            />
          </div>
        </section>
      </main>
    </>
  );
}

function DeletePaymentLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-60 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function DeletePaymentPage({
  params,
}: PageProps<"/trips/[tripId]/costs/payments/[paymentId]/delete">) {
  return (
    <Suspense fallback={<DeletePaymentLoading />}>
      <DeletePaymentContent params={params} />
    </Suspense>
  );
}
