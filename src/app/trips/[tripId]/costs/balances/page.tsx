import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getBalancesForMember, type BalancePerson } from "@/lib/costs";
import { listPaymentsForMember, type PaymentListItem, type PaymentPerson } from "@/lib/payments";
import { paymentDayLabel } from "@/lib/payment-dates";
import type { Payment } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import { Bank, CaretRight, DeviceMobile, Image as ImageIcon, Money } from "@phosphor-icons/react/dist/ssr";
import { Face } from "@/components/face";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, guestTag, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Balances | Sidequest" };

const left = <span className="text-muted"> (left the trip)</span>;

function PersonFace({ person }: { person: BalancePerson }) {
  return <Face userId={person.id} name={person.name} image={person.image} size={36} decorative neutral={person.isGuest} />;
}

// "Dana pays you", "You pay Dana", "Bea pays Jun": the viewer is "you", a left person is marked.
function PaymentRow({
  payment,
  people,
  currency,
  tripId,
}: {
  payment: Payment;
  people: Map<string, BalancePerson>;
  currency: string;
  tripId: string;
}) {
  const from = people.get(payment.from)!;
  const to = people.get(payment.to)!;
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/trips/${tripId}/costs/pay/${payment.from}/${payment.to}`}
        className="flex min-h-12 min-w-0 items-center gap-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text"
      >
        <PersonFace person={from} />
        <span className="min-w-0 flex-1 text-[15px] font-bold wrap-anywhere">
          {from.isYou ? "You" : from.name}
          {from.hasLeft ? left : null} {from.isYou ? "pay" : "pays"}{" "}
          {to.isYou ? "you" : to.name}
          {to.hasLeft ? left : null}
        </span>
        <span className="font-bold whitespace-nowrap tabular-nums">{formatMoney(payment.amount, currency)}</span>
        <CaretRight size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

const methodIcons = { gcash: DeviceMobile, maya: DeviceMobile, bank: Bank, cash: Money };
const methodWords = { gcash: "GCash", maya: "Maya", bank: "Bank", cash: "Cash" };

// "You paid Ana", "Bea paid you", "Bea paid Ana": the viewer is "you", a person who left is marked.
function paidWords(item: PaymentListItem) {
  return (
    <>
      {item.from.isYou ? "You" : item.from.name}
      {item.from.hasLeft ? left : null} paid {item.to.isYou ? "you" : item.to.name}
      {item.to.hasLeft ? left : null}
    </>
  );
}

function PaidFace({ person, people }: { person: PaymentPerson; people: Map<string, BalancePerson> }) {
  const known = people.get(person.spotId);
  if (known) return <PersonFace person={known} />;
  // Someone who left and is even again is not on the balance list: a plain initials circle.
  return <Face userId={person.spotId} name={person.name} image={null} size={36} decorative neutral />;
}

// One recorded payment. Only the payer and the receiver can open it; others see a plain line.
function PaidRow({
  item,
  people,
  tripId,
  timeZone,
}: {
  item: PaymentListItem;
  people: Map<string, BalancePerson>;
  tripId: string;
  timeZone: string;
}) {
  const MethodIcon = methodIcons[item.method];
  const body = (
    <>
      <PaidFace person={item.from} people={people} />
      <span className="grid min-w-0 flex-1">
        <span className="text-[15px] font-bold wrap-anywhere">{paidWords(item)}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          <MethodIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
          {methodWords[item.method]} · {paymentDayLabel(item.createdAt, timeZone)}
          {item.hasReceipt ? (
            <>
              {" "}
              ·
              <ImageIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
              Receipt
            </>
          ) : null}
        </span>
      </span>
    </>
  );
  return (
    <li className="border-t border-line first:border-t-0">
      {item.mine ? (
        <Link
          href={`/trips/${tripId}/costs/payments/${item.id}`}
          className="flex min-h-12 min-w-0 items-center gap-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text"
        >
          {body}
          <span className="font-bold whitespace-nowrap tabular-nums">{formatMoney(item.amount, item.currency)}</span>
          <CaretRight size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
        </Link>
      ) : (
        <div className="flex min-h-12 min-w-0 items-center gap-3 py-1.5">
          {body}
          <span className="font-bold whitespace-nowrap tabular-nums">{formatMoney(item.amount, item.currency)}</span>
        </div>
      )}
    </li>
  );
}

// What the second line under a name says. Only the viewer's own line is colored.
function statusOf(person: BalancePerson): { words: string; className: string } {
  if (person.isYou) {
    if (person.net > 0) return { words: "You're owed", className: "font-bold text-owed" };
    if (person.net < 0) return { words: "You owe", className: "font-bold text-owe" };
    return { words: "are settled", className: "" };
  }
  if (person.net > 0) return { words: "is owed", className: "" };
  if (person.net < 0) return { words: "owes", className: "" };
  return { words: "is settled", className: "" };
}

function BalanceRow({ person, currency }: { person: BalancePerson; currency: string }) {
  const status = statusOf(person);
  const color = person.isYou ? (person.net > 0 ? "text-owed" : person.net < 0 ? "text-owe" : "") : "";
  return (
    <li className="flex min-h-12 min-w-0 items-center gap-3 border-t border-line py-1.5 first:border-t-0">
      <PersonFace person={person} />
      <span className="grid min-w-0 flex-1 text-sm">
        <span className="text-[15px] font-bold wrap-anywhere">
          {person.isYou ? "You" : person.name}
          {person.isGuest ? <span className={`${guestTag} ml-2`}>Guest</span> : null}
          {person.hasLeft ? left : null}
        </span>
        <span className={status.className}>{status.words}</span>
      </span>
      {person.net === 0 ? null : (
        <span className={`font-bold whitespace-nowrap tabular-nums ${color}`}>
          {formatMoney(Math.abs(person.net), currency)}
        </span>
      )}
    </li>
  );
}

// This page sits outside the trip layout, so it checks the person is in the trip for itself.
async function BalancesContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();
  const [balances, paid] = await Promise.all([
    getBalancesForMember(tripId, user.id),
    listPaymentsForMember(tripId, user.id),
  ]);

  const byId = new Map(balances.people.map((person) => [person.spotId, person]));
  const mine = (p: Payment) => byId.get(p.from)?.isYou || byId.get(p.to)?.isYou;
  const payments = [...balances.payments.filter(mine), ...balances.payments.filter((p) => !mine(p))];
  const people = [...balances.people.filter((p) => p.isYou), ...balances.people.filter((p) => !p.isYou)];

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel="Costs" title="Balances" />
      <main className={screenClass}>
        {balances.costCount === 0 ? (
          <section className={`${cardClass} gap-3 px-5 py-6`}>
            <p className="font-display text-[19px] font-bold">No costs yet.</p>
            <Link href={`/trips/${trip.id}/costs`} className={linkClass}>
              Back to Costs
            </Link>
          </section>
        ) : (
          <>
            <section className={`${cardClass} gap-3 px-5 py-4`} aria-label="Settle up">
              <div>
                <h2 className="text-[19px]">Settle up</h2>
                <p className={helpClass}>The fewest payments to make everyone even. Tap one to see how to pay.</p>
              </div>
              {payments.length === 0 ? (
                <p>Everyone&apos;s even. Nothing to pay.</p>
              ) : (
                <ul>
                  {payments.map((payment) => (
                    <PaymentRow
                      key={`${payment.from}-${payment.to}`}
                      payment={payment}
                      people={byId}
                      currency={trip.currency}
                      tripId={trip.id}
                    />
                  ))}
                </ul>
              )}
            </section>
            {paid.length > 0 ? (
              <section className={`${cardClass} gap-3 px-5 py-4`} aria-label="Payments">
                <h2 className="text-[19px]">Payments</h2>
                <ul>
                  {paid.map((item) => (
                    <PaidRow key={item.id} item={item} people={byId} tripId={trip.id} timeZone={trip.timeZone} />
                  ))}
                </ul>
              </section>
            ) : null}
            <section className={`${cardClass} gap-3 px-5 py-4`} aria-label="Everyone's balance">
              <h2 className="text-[19px]">Everyone&apos;s balance</h2>
              <ul>
                {people.map((person) => (
                  <BalanceRow key={person.spotId} person={person} currency={trip.currency} />
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function BalancesLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-44 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-56 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function BalancesPage({ params }: PageProps<"/trips/[tripId]/costs/balances">) {
  return (
    <Suspense fallback={<BalancesLoading />}>
      <BalancesContent params={params} />
    </Suspense>
  );
}
