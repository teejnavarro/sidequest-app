import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserForPage } from "@/lib/current-user";
import { ConfirmForm } from "@/components/confirm-form";
import { TaskBand } from "@/components/task-band";
import { cardClass, primaryButton, screenClass, skeleton } from "@/components/ui";
import { accountLabel } from "@/lib/payment-input";
import { getMyPaymentAccount } from "@/lib/payments";
import { deletePaymentAccountAction } from "../../actions";

async function DeletePaymentDetailsContent({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const user = await getCurrentUserForPage();
  const account = await getMyPaymentAccount(user.id, accountId);
  if (!account) notFound();

  return (
    <section className={`${cardClass} gap-4 px-5 py-6`} aria-labelledby="delete-title">
      <h2 id="delete-title" className="text-[19px] wrap-anywhere">
        Delete your {accountLabel(account)} details?
      </h2>
      <p>People in your trips won&apos;t see them anymore.</p>
      <div className="grid gap-3">
        <Link href={`/profile/payment-details/${account.id}/edit`} className={`${primaryButton} w-full`}>
          Keep details
        </Link>
        <ConfirmForm
          action={deletePaymentAccountAction}
          fields={{ accountId: account.id }}
          label="Delete details"
          pendingLabel="Deleting…"
          tone="danger"
        />
      </div>
    </section>
  );
}

export const metadata: Metadata = { title: "Delete payment details | Sidequest" };

export default function DeletePaymentDetailsPage({
  params,
}: PageProps<"/profile/payment-details/[accountId]/delete">) {
  return (
    <>
      <TaskBand backHref="/profile" backLabel="Profile" title="Delete details" />
      <main className={screenClass}>
        <Suspense fallback={<div aria-hidden="true" className={`h-60 ${skeleton} rounded-card bg-chip`} />}>
          <DeletePaymentDetailsContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
