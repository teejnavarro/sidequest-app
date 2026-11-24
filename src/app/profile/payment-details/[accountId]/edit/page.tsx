import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { PaymentAccountForm } from "@/components/payment-account-form";
import { TaskBand } from "@/components/task-band";
import { cardClass, linkClass, screenClass, skeleton } from "@/components/ui";
import { getMyPaymentAccount } from "@/lib/payments";

// Only the person who saved these details gets here: anyone else sees the same "not found" as
// for details that do not exist.
async function EditPaymentDetailsContent({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const user = await getCurrentUser();
  const account = await getMyPaymentAccount(user.id, accountId);
  if (!account) notFound();

  return (
    <>
      <div className={`${cardClass} gap-4`}>
        <PaymentAccountForm
          accountId={account.id}
          values={{
            kind: account.kind,
            bankName: account.bankName ?? "",
            accountName: account.accountName,
            number: account.number,
          }}
          savedQrSrc={account.hasQr ? `/profile/payment-details/${account.id}/qr` : null}
        />
      </div>
      <Link href={`/profile/payment-details/${account.id}/delete`} className={`${linkClass} justify-self-start text-owe`}>
        Delete these details
      </Link>
    </>
  );
}

export const metadata: Metadata = { title: "Edit payment details | Sidequest" };

export default function EditPaymentDetailsPage({
  params,
}: PageProps<"/profile/payment-details/[accountId]/edit">) {
  return (
    <>
      <TaskBand backHref="/profile" backLabel="Profile" title="Edit payment details" />
      <main className={screenClass}>
        <Suspense fallback={<div aria-hidden="true" className={`h-96 ${skeleton} rounded-card bg-chip`} />}>
          <EditPaymentDetailsContent params={params} />
        </Suspense>
      </main>
    </>
  );
}
