import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentUserForPage } from "@/lib/current-user";
import { PaymentAccountForm } from "@/components/payment-account-form";
import { TaskBand } from "@/components/task-band";
import { cardClass, screenClass, skeleton } from "@/components/ui";
import { emptyAccountValues } from "@/lib/payment-form-state";

async function NewPaymentDetailsContent() {
  await getCurrentUserForPage(); // signed-in people only
  return (
    <div className={`${cardClass} gap-4`}>
      <PaymentAccountForm accountId={null} values={emptyAccountValues} savedQrSrc={null} />
    </div>
  );
}

export const metadata: Metadata = { title: "Add payment details | Sidequest" };

export default function NewPaymentDetailsPage() {
  return (
    <>
      <TaskBand backHref="/profile" backLabel="Profile" title="Add payment details" />
      <main className={screenClass}>
        <Suspense fallback={<div aria-hidden="true" className={`h-96 ${skeleton} rounded-card bg-chip`} />}>
          <NewPaymentDetailsContent />
        </Suspense>
      </main>
    </>
  );
}
