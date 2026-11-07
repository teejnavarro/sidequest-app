import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { getTripForMember } from "@/lib/trips";
import { listIdeasForMember } from "@/lib/ideas";
import { IDEA_TYPES, isIdeaType } from "@/lib/idea-options";
import { IdeaCard } from "@/components/idea-card";
import { IdeaTypeIcon } from "@/components/idea-type";
import {
  cardClass,
  chipClass,
  chipSelectedClass,
  primaryButton,
  screenClass,
  skeleton,
} from "@/components/ui";

export const metadata: Metadata = { title: "Ideas | Sidequest" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// This page sits inside the trip layout, but that check does not protect it: it checks that
// the person is in the trip for itself. The filter is just a word in the address
// (?type=food), so Back and refresh keep it. An unknown or unused type means "All".
async function IdeasContent({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: SearchParams;
}) {
  const { tripId } = await params;
  const { type: typeParam } = await searchParams;
  const user = await getCurrentUser();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const ideas = await listIdeasForMember(tripId, user.id);

  // Only types that have ideas get a chip, each with its count.
  const counts = new Map<string, number>();
  for (const idea of ideas) counts.set(idea.type, (counts.get(idea.type) ?? 0) + 1);
  const requested = typeof typeParam === "string" ? typeParam : "";
  const selected = isIdeaType(requested) && counts.has(requested) ? requested : "all";
  const shown = selected === "all" ? ideas : ideas.filter((idea) => idea.type === selected);

  const base = `/trips/${tripId}/ideas`;
  const addHref = `${base}/new`;
  const addButton = (
    <Link href={addHref} className={`${primaryButton} w-full`}>
      <Plus size={20} weight="bold" aria-hidden="true" />
      Add an idea
    </Link>
  );

  if (ideas.length === 0) {
    return (
      <main className={`${screenClass} flex-1`}>
        <section className={`${cardClass} gap-3 px-5 py-6`}>
          <h2 className="text-[19px]">No ideas yet</h2>
          <p>Every &quot;we should totally go here&quot; in one place.</p>
          <p className="text-[13px] text-muted">Start with one place you&apos;d love to go.</p>
          {addButton}
        </section>
      </main>
    );
  }

  return (
    <main className={`${screenClass} flex-1`}>
      <nav aria-label="Filter by type" className="flex flex-wrap gap-2">
        <Link
          href={base}
          aria-current={selected === "all" ? "page" : undefined}
          className={selected === "all" ? chipSelectedClass : chipClass}
        >
          All <span className="font-medium tabular-nums">{ideas.length}</span>
        </Link>
        {IDEA_TYPES.filter((type) => counts.has(type.value)).map((type) => (
          <Link
            key={type.value}
            href={`${base}?type=${type.value}`}
            aria-current={selected === type.value ? "page" : undefined}
            className={selected === type.value ? chipSelectedClass : chipClass}
          >
            <IdeaTypeIcon type={type.value} />
            {type.label} <span className="font-medium tabular-nums">{counts.get(type.value)}</span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-4">
        {shown.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            tripId={tripId}
            canChange={idea.addedBy.id === user.id || trip.ownerId === user.id}
          />
        ))}
      </div>

      {addButton}
    </main>
  );
}

function IdeasLoading() {
  return (
    <div className={`${screenClass} flex-1`} aria-hidden="true">
      <div className="flex gap-2">
        <div className={`h-11 w-16 ${skeleton} rounded-full bg-chip`} />
        <div className={`h-11 w-24 ${skeleton} rounded-full bg-chip`} />
        <div className={`h-11 w-28 ${skeleton} rounded-full bg-chip`} />
      </div>
      {[0, 1, 2].map((n) => (
        <div key={n} className={`${cardClass} gap-3`}>
          <div className={`h-6 w-2/3 ${skeleton} rounded-full bg-chip`} />
          <div className={`h-4 w-3/4 ${skeleton} rounded-full bg-chip`} />
          <div className={`h-4 w-1/3 ${skeleton} rounded-full bg-chip`} />
        </div>
      ))}
      <div className={`h-12 ${skeleton} rounded-full bg-chip`} />
    </div>
  );
}

export default function IdeasPage({
  params,
  searchParams,
}: PageProps<"/trips/[tripId]/ideas">) {
  return (
    <Suspense fallback={<IdeasLoading />}>
      <IdeasContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
