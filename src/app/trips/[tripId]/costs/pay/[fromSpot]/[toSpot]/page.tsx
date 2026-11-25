import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bank, DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getPayPageForMember, type PayPage, type PaymentAccountView } from "@/lib/payments";
import { FORMER_MEMBER_NAME } from "@/lib/display-name";
import { amountText, formatMoney } from "@/lib/money";
import { accountLabel, formatAccountNumber } from "@/lib/payment-input";
import { CopyButton } from "@/components/copy-button";
import { PayForm } from "@/components/pay-form";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Pay | Sidequest" };

type Params = Promise<{ tripId: string; fromSpot: string; toSpot: string }>;

// One of the receiver's saved accounts: label, name, the number big enough to read aloud with a
// Copy button (digits only), and the QR picture when there is one. The QR comes through the
// route that checks who is asking; tapping it opens it full size in a new tab.
function AccountBlock({ account }: { account: PaymentAccountView }) {
  const Icon = account.kind === "bank" ? Bank : DeviceMobile;
  const label = accountLabel(account);
  const qr = `/profile/payment-details/${account.id}/qr`;
  return (
    <div className="grid min-w-0 gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-soft text-blue-text">
          <Icon size={22} weight="bold" aria-hidden="true" />
        </span>
        <span className="grid min-w-0">
          <span className="text-[15px] font-bold wrap-anywhere">{label}</span>
          <span className="text-sm text-muted wrap-anywhere">{account.accountName}</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 text-[22px] font-bold tracking-wide tabular-nums wrap-anywhere">
          {formatAccountNumber(account.kind, account.number)}
        </span>
        <CopyButton text={account.number} label={`${label} number`} />
      </div>
      {account.hasQr ? (
        <a
          href={qr}
          target="_blank"
          rel="noopener"
          className="justify-self-start rounded-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text"
        >
          {/* The QR is served by a route that checks who is asking; next/image would copy it through the optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt={`${label} QR code for ${account.accountName}`}
            width={220}
            height={220}
            className="size-[220px] max-w-full rounded-field border border-line bg-card object-contain"
          />
        </a>
      ) : null}
    </div>
  );
}

function titleOf(page: PayPage): string {
  if (page.from.isYou) return `Pay ${page.to.name}`;
  if (page.to.isYou) return `${page.from.name} pays you`;
  return `${page.from.name} pays ${page.to.name}`;
}

function receiverReason(page: PayPage): string {
  const name = page.to.name;
  if ("accounts" in page.receiver) return "";
  if (page.receiver.reason === "guest") return `${name} is a guest, so there are no saved details.`;
  if (name === FORMER_MEMBER_NAME) return "This person deleted their account, so there are no details to show.";
  if (page.receiver.reason === "left") return `${name} left the trip, so their details are hidden.`;
  return `${name} hasn't added payment details yet. Ask them in the group chat.`;
}

// This page sits outside the trip layout, so it checks the person is in the trip for itself.
// Anyone in the trip may look at a line; only the payer and the receiver get "Mark it paid".
async function PayContent({ params }: { params: Params }) {
  const { tripId, fromSpot, toSpot } = await params;
  const user = await getCurrentUser();
  const [trip, page] = await Promise.all([
    getTripForMember(tripId, user.id),
    getPayPageForMember(tripId, fromSpot, toSpot, user.id),
  ]);
  if (!trip || !page) notFound();

  const balances = `/trips/${trip.id}/costs/balances`;
  const { from, to } = page;
  const sentence = from.isYou ? `You pay ${to.name}` : to.isYou ? `${from.name} pays you` : `${from.name} pays ${to.name}`;
  const myLabels = "accounts" in page.receiver ? page.receiver.accounts.map(accountLabel).join(" and ") : "";

  return (
    <>
      <TaskBand backHref={balances} backLabel="Balances" title={titleOf(page)} />
      <main className={screenClass}>
        {page.amount === 0 ? (
          <section className={`${cardClass} gap-3 px-5 py-6`}>
            <p className="font-display text-[19px] font-bold">Nothing to pay here anymore.</p>
            <p>Balances changed.</p>
            <Link href={balances} className={linkClass}>
              Back to Balances
            </Link>
          </section>
        ) : (
          <>
            <section className={`${cardClass} gap-2 px-5 py-4`} aria-label="Amount">
              <p className="text-sm font-bold text-muted wrap-anywhere">{sentence}</p>
              <p className={`font-display text-[30px] leading-tight font-bold tabular-nums ${to.isYou ? "text-owed" : ""}`}>
                {formatMoney(page.amount, page.currency)}
              </p>
              {to.isYou ? (
                <p className={`${helpClass} wrap-anywhere`}>
                  {myLabels
                    ? `${from.name} sees your details here: ${myLabels}. `
                    : `You haven't added payment details yet, so ${from.name} can't see how to pay you. `}
                  <Link href="/profile" className="underline">
                    {myLabels ? "Change them on Profile" : "Add them on Profile"}
                  </Link>
                  .
                </p>
              ) : null}
            </section>

            {to.isYou ? null : (
              <section className={`${cardClass} gap-4 px-5 py-4`} aria-label={`${to.name}'s details`}>
                <h2 className="text-[19px] wrap-anywhere">{to.name}&apos;s details</h2>
                {"accounts" in page.receiver ? (
                  page.receiver.accounts.map((account) => <AccountBlock key={account.id} account={account} />)
                ) : (
                  <p className="wrap-anywhere">{receiverReason(page)}</p>
                )}
              </section>
            )}

            {page.canRecord ? (
              <section className={`${cardClass} px-5 py-4`}>
                <PayForm
                  tripId={trip.id}
                  paymentId={crypto.randomUUID()}
                  fromSpot={from.spotId}
                  toSpot={to.spotId}
                  currency={page.currency}
                  maxAmount={page.amount}
                  amountPrefill={amountText(page.amount, page.currency)}
                  payerName={from.name}
                  receiverName={to.name}
                  payerIsYou={from.isYou}
                  receiverIsYou={to.isYou}
                  otherName={to.isYou ? from.name : to.name}
                  heading={to.isYou ? "Got the money?" : "Mark it paid"}
                  methodLegend={to.isYou ? `How did ${from.name} pay?` : "How did you pay?"}
                />
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

function PayLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-28 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-64 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-72 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function PayPage({ params }: PageProps<"/trips/[tripId]/costs/pay/[fromSpot]/[toSpot]">) {
  return (
    <Suspense fallback={<PayLoading />}>
      <PayContent params={params} />
    </Suspense>
  );
}
