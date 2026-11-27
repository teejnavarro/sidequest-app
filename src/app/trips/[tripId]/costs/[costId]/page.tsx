import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Info, PencilSimple, PlusCircle } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUserForPage } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { getCostBreakdownForMember, type CostPerson } from "@/lib/costs";
import { isEvenSplit } from "@/lib/cost-form-state";
import { costCategoryOf } from "@/lib/cost-options";
import { formatMoney, rateText } from "@/lib/money";
import { paymentTimeLabel } from "@/lib/payment-dates";
import { dayLabel } from "@/lib/schedule-options";
import { CostCategoryIcon } from "@/components/cost-category";
import { CostPhotoBox } from "@/components/cost-photo-box";
import { Face } from "@/components/face";
import { TaskBand, TaskBandLoading } from "@/components/task-band";
import { cardClass, guestTag, helpClass, linkClass, quietButton, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Cost | Sidequest" };

const left = <span className="text-muted"> (left the trip)</span>;

function PersonFace({ person, size }: { person: CostPerson; size: number }) {
  return <Face userId={person.id} name={person.name} image={person.image} size={size} decorative neutral={person.isGuest} />;
}

// The marks after a name: the Guest tag and "(left the trip)", as on Balances.
function Marks({ person }: { person: CostPerson }) {
  return (
    <>
      {person.isGuest ? <span className={`${guestTag} ml-2`}>Guest</span> : null}
      {person.hasLeft ? left : null}
    </>
  );
}

// This page sits outside the trip layout, so it checks for itself. Anyone who is not in the
// trip sees the same "not found" as for a cost that does not exist or is in the trash.
async function CostContent({ params }: { params: Promise<{ tripId: string; costId: string }> }) {
  const { tripId, costId } = await params;
  const user = await getCurrentUserForPage();
  const [trip, cost] = await Promise.all([
    getTripForMember(tripId, user.id),
    getCostBreakdownForMember(tripId, costId, user.id),
  ]);
  if (!trip || !cost) notFound();

  const { original } = cost;
  const money = (minor: number) => formatMoney(minor, cost.currency);
  const foreign = original
    ? original.rate
      ? `${formatMoney(original.amount, original.currency)} at ${rateText(original.rate, original.currency, cost.currency)} · ${money(cost.amount)}`
      : `${formatMoney(original.amount, original.currency)}, charged as ${money(cost.amount)}`
    : null;
  const day = dayLabel(cost.spentOn);

  // The viewer first, then the others in trip order, the payer's own share last.
  const isPayer = (spotId: string) => spotId === cost.paidBy;
  const rest = cost.shares.filter((share) => !isPayer(share.spotId));
  const shares = [...rest.filter((s) => s.isYou), ...rest.filter((s) => !s.isYou), ...cost.shares.filter((s) => isPayer(s.spotId))];
  const viewerIn = cost.shares.some((share) => share.isYou);
  const url = `/trips/${trip.id}/costs/${cost.id}`;
  const who = (person: { name: string; isYou: boolean }) => (person.isYou ? "you" : person.name);

  return (
    <>
      <TaskBand backHref={`/trips/${trip.id}/costs`} backLabel="Costs" title="Cost" />
      <main className={screenClass}>
        <section
          className={`${cardClass} grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-5 py-4`}
          aria-label="Cost"
        >
          <span className="grid size-11 place-items-center rounded-full bg-blue-soft text-blue-text">
            <CostCategoryIcon category={cost.category} size={22} />
          </span>
          <div className="grid min-w-0 gap-0.5">
            <h2 className="text-[19px] wrap-anywhere">{cost.description}</h2>
            <p className="font-display text-[30px] leading-tight font-bold tabular-nums wrap-anywhere">{money(cost.amount)}</p>
            {foreign ? <p className={`${helpClass} wrap-anywhere`}>{foreign}</p> : null}
            <p className={helpClass}>{cost.category ? `${day} · ${costCategoryOf(cost.category).label}` : day}</p>
          </div>
          <CostPhotoBox tripId={trip.id} costId={cost.id} photoSrc={cost.photo ? `${url}/photo` : null} />
        </section>

        <section className={`${cardClass} gap-3 px-5 py-4`} aria-label="Who paid and who owes">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <PersonFace person={cost.payer} size={36} />
            <span className="min-w-0 text-[15px] font-bold wrap-anywhere">
              {cost.payer.isYou ? "You" : cost.payer.name} paid {money(cost.amount)}
              <Marks person={cost.payer} />
            </span>
            {isEvenSplit(cost) ? null : <span className={guestTag}>Not an even split</span>}
          </div>
          <ul className="ml-[17px] grid border-l-2 border-line">
            {shares.map((share) => {
              const payer = isPayer(share.spotId);
              const owes = share.isYou && !payer;
              const words = payer ? (share.isYou ? "Your share" : `${share.name}'s share`) : owes ? "You owe" : `${share.name} owes`;
              return (
                <li key={share.spotId} className="flex min-h-11 min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="h-0.5 w-3 shrink-0 bg-line" />
                  <PersonFace person={share} size={28} />
                  <span className="grid min-w-0 flex-1">
                    <span className={`text-[15px] wrap-anywhere ${owes ? "font-bold text-owe" : ""}`}>
                      {words}
                      <Marks person={share} />
                    </span>
                    {original && share.originalAmount !== null ? (
                      <span className={helpClass}>{formatMoney(share.originalAmount, original.currency)}</span>
                    ) : null}
                  </span>
                  <span className={`font-bold whitespace-nowrap tabular-nums ${owes ? "text-owe" : ""}`}>{money(share.amount)}</span>
                </li>
              );
            })}
          </ul>
          {viewerIn ? null : <p className={helpClass}>You&apos;re not in this one.</p>}
          <p className="flex items-start gap-2 rounded-field bg-chip px-3 py-2 text-[13px]">
            <Info size={18} weight="bold" aria-hidden="true" className="mt-px shrink-0" />
            <span>
              For this cost only. Payments and other costs are on{" "}
              <Link href={`/trips/${trip.id}/costs/balances`} className="font-bold underline underline-offset-2">
                Balances
              </Link>
              .
            </span>
          </p>
        </section>

        <section className={`${cardClass} gap-2 px-5 py-4`} aria-label="History">
          <p className="flex items-center gap-2 text-sm">
            <PlusCircle size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
            <span>
              Added by {who(cost.addedBy)} · {paymentTimeLabel(cost.createdAt, trip.timeZone)}
            </span>
          </p>
          {cost.photo ? (
            <p className="flex items-center gap-2 text-sm">
              <Camera size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
              <span>
                Photo added by {cost.photo.by} · {paymentTimeLabel(cost.photo.at, trip.timeZone)}
              </span>
            </p>
          ) : null}
          {cost.editedBy ? (
            <p className="flex items-center gap-2 text-sm">
              <PencilSimple size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
              <span>
                Last edited by {who(cost.editedBy)} · {paymentTimeLabel(cost.updatedAt, trip.timeZone)}
              </span>
            </p>
          ) : null}
        </section>

        <Link href={`${url}/edit`} className={`${quietButton} w-full`}>
          <PencilSimple size={20} weight="bold" aria-hidden="true" />
          Edit cost
        </Link>
        <Link href={`${url}/delete`} className={`${linkClass} justify-self-start text-owe`}>
          Delete cost
        </Link>
      </main>
    </>
  );
}

function CostLoading() {
  return (
    <>
      <TaskBandLoading />
      <div className={screenClass} aria-hidden="true">
        <div className={`h-32 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-56 ${skeleton} rounded-card bg-chip`} />
        <div className={`h-20 ${skeleton} rounded-card bg-chip`} />
      </div>
    </>
  );
}

export default function CostPage({ params }: PageProps<"/trips/[tripId]/costs/[costId]">) {
  return (
    <Suspense fallback={<CostLoading />}>
      <CostContent params={params} />
    </Suspense>
  );
}
