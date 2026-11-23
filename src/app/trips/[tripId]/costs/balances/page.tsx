import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getBalancesForMember, type BalancePerson } from "@/lib/costs";
import type { Payment } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import { Face } from "@/components/face";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, guestTag, helpClass, linkClass, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Balances | Sidequest" };

const left = <span className="text-muted"> (left the trip)</span>;

function PersonFace({ person }: { person: BalancePerson }) {
  return <Face userId={person.id} name={person.name} image={person.image} size={36} decorative neutral={person.isGuest} />;
}

// "Dana pays you", "You pay Dana", "Bea pays Jun": the viewer is "you", a left person is marked.
function PaymentRow({ payment, people, currency }: { payment: Payment; people: Map<string, BalancePerson>; currency: string }) {
  const from = people.get(payment.from)!;
  const to = people.get(payment.to)!;
  return (
    <li className="flex min-h-12 min-w-0 items-center gap-3 border-t border-line py-1.5 first:border-t-0">
      <PersonFace person={from} />
      <span className="min-w-0 flex-1 text-[15px] font-bold wrap-anywhere">
        {from.isYou ? "You" : from.name}
        {from.hasLeft ? left : null} {from.isYou ? "pay" : "pays"}{" "}
        {to.isYou ? "you" : to.name}
        {to.hasLeft ? left : null}
      </span>
      <span className="font-bold whitespace-nowrap tabular-nums">{formatMoney(payment.amount, currency)}</span>
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
  const balances = await getBalancesForMember(tripId, user.id);

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
                <p className={helpClass}>The fewest payments to make everyone even.</p>
              </div>
              {payments.length === 0 ? (
                <p>Everyone&apos;s even. Nothing to pay.</p>
              ) : (
                <>
                  <ul>
                    {payments.map((payment) => (
                      <PaymentRow key={`${payment.from}-${payment.to}`} payment={payment} people={byId} currency={trip.currency} />
                    ))}
                  </ul>
                  <p className={helpClass}>Paid someone back? Marking it here comes in a later update.</p>
                </>
              )}
            </section>
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
