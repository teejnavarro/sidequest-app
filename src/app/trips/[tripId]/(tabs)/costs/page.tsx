import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { listCostsForMember, type CostListItem } from "@/lib/costs";
import { formatMoney } from "@/lib/money";
import { dayLabel } from "@/lib/schedule-options";
import { CostCategoryIcon } from "@/components/cost-category";
import { cardClass, focusRing, primaryButton, screenClass, skeleton } from "@/components/ui";

export const metadata: Metadata = { title: "Costs | Sidequest" };

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One row: what, how much, who paid, the viewer's share, and who added or edited it. The
// whole row opens the Edit page.
function CostRow({ cost, tripId }: { cost: CostListItem; tripId: string }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/trips/${tripId}/costs/${cost.id}/edit`}
        className={`grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 py-3 ${focusRing}`}
      >
        <span className="row-span-3 grid size-10 place-items-center rounded-full bg-blue-soft text-blue-text">
          <CostCategoryIcon category={cost.category} />
        </span>
        <span className="text-[15px] font-bold wrap-anywhere">{cost.description}</span>
        <span className="text-[15px] font-bold tabular-nums">{formatMoney(cost.amount, cost.currency)}</span>
        <span className="col-span-2 text-[13px] text-muted wrap-anywhere">
          {cost.payer.isYou ? "You" : cost.payer.name}
          {cost.payer.hasLeft ? <span className="text-muted"> (left the trip)</span> : null} paid · split {count(cost.shareCount, "way")} ·{" "}
          {cost.myShare === null ? (
            "you're not in this one"
          ) : (
            <span className="font-bold text-blue-text tabular-nums">
              your share {formatMoney(cost.myShare, cost.currency)}
            </span>
          )}
        </span>
        <span className="col-span-2 text-xs text-muted wrap-anywhere">
          Added by {cost.addedBy}
          {cost.editedBy ? ` · edited by ${cost.editedBy}` : ""}
        </span>
      </Link>
    </li>
  );
}

// Costs come newest day first, so the same days sit next to each other.
function groupByDay(costs: CostListItem[]): { day: string; costs: CostListItem[] }[] {
  const groups: { day: string; costs: CostListItem[] }[] = [];
  for (const cost of costs) {
    const last = groups[groups.length - 1];
    if (last && last.day === cost.spentOn) last.costs.push(cost);
    else groups.push({ day: cost.spentOn, costs: [cost] });
  }
  return groups;
}

// This page sits inside the trip layout, but that check does not protect it: it checks that
// the person is in the trip for itself.
async function CostsContent({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const { costs, total } = await listCostsForMember(tripId, user.id);

  const logButton = (
    <Link href={`/trips/${tripId}/costs/new`} className={`${primaryButton} w-full`}>
      <Plus size={20} weight="bold" aria-hidden="true" />
      Log a cost
    </Link>
  );

  if (costs.length === 0) {
    return (
      <main className={`${screenClass} flex-1`}>
        <section className={`${cardClass} gap-3 px-5 py-6`}>
          <p className="font-display text-[19px] font-bold">No costs yet.</p>
          <p>Log the first one: who paid, and who shares it.</p>
          {logButton}
        </section>
      </main>
    );
  }

  return (
    <main className={`${screenClass} flex-1`}>
      <section aria-label="Total" className={`${cardClass} gap-1 px-5 py-4`}>
        <p className="text-[13px] font-bold text-muted">Logged so far</p>
        <p className="font-display text-[30px] leading-none font-bold tabular-nums">
          {formatMoney(total, trip.currency)}
        </p>
        <p className="text-[13px] text-muted">{count(costs.length, "cost")}. Who owes whom comes soon.</p>
      </section>

      {logButton}

      <section aria-label="Costs" className={`${cardClass} gap-0 py-1`}>
        {groupByDay(costs).map((group) => (
          <div key={group.day}>
            <h2 className="pt-3 text-[13px] font-bold text-muted">{dayLabel(group.day)}</h2>
            <ul>
              {group.costs.map((cost) => (
                <CostRow key={cost.id} cost={cost} tripId={tripId} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}

function CostsLoading() {
  return (
    <div className={`${screenClass} flex-1`} aria-hidden="true">
      <div className={`h-28 ${skeleton} rounded-card bg-chip`} />
      <div className={`h-12 ${skeleton} rounded-full bg-chip`} />
      <div className={`${cardClass} gap-4`}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex gap-3">
            <div className={`size-10 ${skeleton} rounded-full bg-chip`} />
            <div className="grid flex-1 gap-2">
              <div className={`h-4 w-2/3 ${skeleton} rounded-full bg-chip`} />
              <div className={`h-3 w-3/4 ${skeleton} rounded-full bg-chip`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CostsPage({ params }: PageProps<"/trips/[tripId]/costs">) {
  return (
    <Suspense fallback={<CostsLoading />}>
      <CostsContent params={params} />
    </Suspense>
  );
}
