import Link from "next/link";
import {
  ArrowSquareOut,
  CalendarPlus,
  CaretDown,
  Check,
  Clock,
  Coins,
  MapPin,
  MapTrifold,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";
import { ApproveButton } from "@/components/approve-button";
import { Face } from "@/components/face";
import { IdeaTypeIcon } from "@/components/idea-type";
import { VoteButtons } from "@/components/vote-buttons";
import { cardClass, focusRing, smallQuietButton, softTag } from "@/components/ui";
import { durationLabel, formatCost, ideaTypeOf, linkLabel } from "@/lib/idea-options";
import type { IdeaItem } from "@/lib/ideas";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

// One idea. Notes, the link and Edit open inside the card, so the list stays short. Edit is
// only shown to the person who added the idea and to the trip owner; hiding it is a
// courtesy, because the database decides who may really change an idea.
export function IdeaCard({
  idea,
  tripId,
  canChange,
}: {
  idea: IdeaItem;
  tripId: string;
  canChange: boolean;
}) {
  const type = ideaTypeOf(idea.type);
  const hasMore = Boolean(idea.notes || idea.link || canChange);
  const onlyEdit = !idea.notes && !idea.link;
  const approved = idea.approvedAt !== null;

  return (
    <article className={`${cardClass} gap-3 ${approved ? "border-blue-text" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-[17px] [overflow-wrap:anywhere]">{idea.name}</h3>
        <span className={`${softTag} gap-1`}>
          <IdeaTypeIcon type={idea.type} size={14} />
          {type.label}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock size={16} weight="bold" aria-hidden="true" />
          {durationLabel(idea.duration)}
        </span>
        {idea.costPerPerson !== null && idea.costCurrency ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Coins size={16} weight="bold" aria-hidden="true" />
            about {formatCost(idea.costPerPerson, idea.costCurrency)} each
          </span>
        ) : null}
        {idea.area ? (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin size={16} weight="bold" aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{idea.area}</span>
          </span>
        ) : null}
      </p>

      {approved ? (
        // text-card is white on the light blue-text and dark on the dark one, so it reads in both.
        <span className="inline-flex items-center gap-1 justify-self-start rounded-full bg-blue-text px-2.5 py-0.5 text-xs font-bold text-card">
          <Check size={14} weight="bold" aria-hidden="true" />
          {idea.approvedBy ? `Approved by ${firstName(idea.approvedBy.name)}` : "Approved"}
        </span>
      ) : null}

      {hasMore ? (
        <details className="group grid gap-3">
          <summary
            className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 justify-self-start text-[13px] font-bold text-blue-text [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            {onlyEdit ? "More" : "Notes and link"}
            <CaretDown
              size={14}
              weight="bold"
              aria-hidden="true"
              className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          {idea.notes ? <p className="text-[14px] whitespace-pre-line [overflow-wrap:anywhere]">{idea.notes}</p> : null}
          <div className="flex flex-wrap gap-2">
            {idea.link ? (
              <a
                href={idea.link}
                target="_blank"
                rel="noopener noreferrer"
                className={smallQuietButton}
              >
                {linkLabel(idea.link) === "Open in Google Maps" ? (
                  <MapTrifold size={18} weight="bold" aria-hidden="true" />
                ) : (
                  <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
                )}
                {linkLabel(idea.link)}
              </a>
            ) : null}
            {canChange ? (
              <Link href={`/trips/${tripId}/ideas/${idea.id}/edit`} className={smallQuietButton}>
                <PencilSimple size={18} weight="bold" aria-hidden="true" />
                Edit idea
              </Link>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <VoteButtons
          tripId={tripId}
          ideaId={idea.id}
          initial={{ up: idea.up, down: idea.down, myVote: idea.myVote }}
        />
        <div className="flex flex-wrap items-start gap-2">
          {approved ? (
            <Link href={`/trips/${tripId}/schedule/add?idea=${idea.id}`} className={smallQuietButton}>
              <CalendarPlus size={18} weight="bold" aria-hidden="true" />
              Schedule it
            </Link>
          ) : null}
          <ApproveButton tripId={tripId} ideaId={idea.id} approved={approved} />
        </div>
      </div>

      <p className="flex items-center gap-2 text-[13px] text-muted [overflow-wrap:anywhere]">
        <Face userId={idea.addedBy.id} name={idea.addedBy.name} image={idea.addedBy.image} size={22} decorative />
        Added by {firstName(idea.addedBy.name)}
      </p>
    </article>
  );
}
