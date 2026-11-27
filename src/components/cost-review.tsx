import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { costCategoryOf } from "@/lib/cost-options";
import type { CostReview } from "@/lib/cost-form-state";
import { formatMoney, minorUnitName, rateText } from "@/lib/money";
import { dayLabel } from "@/lib/schedule-options";

const FIELD_LABELS = {
  main: "Amount in trip currency",
  amount: "Amount",
  rate: "Rate",
  description: "What was it?",
  paidBy: "Who paid?",
  spentOn: "Date",
  category: "Category",
  photo: "Receipt photo",
} as const;

const who = (person: { name: string; isYou: boolean }) => (person.isYou ? "You" : person.name);

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// The sentence for a split that has a leftover, or nothing when it divides evenly.
function extraSentence(review: CostReview): string | null {
  if (review.extraTakers.length === 0) return null;
  // On a cost in another currency the equal part is worked out in that currency.
  const currency = review.original?.currency ?? review.currency;
  const unit = minorUnitName(currency);
  const names = joinNames(review.extraTakers.map(who));
  const part =
    review.extraTakers.length === 1
      ? `${names} ${review.extraTakers[0].isYou ? "take" : "takes"} the extra ${unit}`
      : `${names} each take one extra ${unit}`;
  // On an uneven split only what is left over after the own amounts is divided.
  const divided = formatMoney(review.rest, currency);
  const subject = review.uneven ? `${divided} left over` : formatMoney(review.original?.amount ?? review.amount, currency);
  return `${subject} doesn't split evenly ${review.shares.length} ways, so ${part}. The shares always add up to the total.`;
}

// Old value struck through, an arrow, the new value.
function Before({ was, now }: { was: string; now: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 wrap-anywhere">
      <s className="text-muted">{was}</s>
      <ArrowRight size={14} weight="bold" aria-hidden="true" className="shrink-0" />
      <span className="sr-only">now</span>
      <span className="font-bold">{now}</span>
    </span>
  );
}

// The muted line under the summary for a cost in another currency: what was typed and the rate.
function originalLine(review: CostReview): string | null {
  const { original } = review;
  if (!original) return null;
  const typed = formatMoney(original.amount, original.currency);
  if (original.rate !== null) return `${typed} at ${rateText(original.rate, original.currency, review.currency)}`;
  const effective = rateText(original.effectiveRate, original.currency, review.currency);
  return `${typed}, card charged ${formatMoney(review.amount, review.currency)} (${effective})`;
}

// What the server worked out, shown before saving. A new cost shows the split; an edit shows
// only what changed. The buttons live in the form around this.
export function CostReviewView({ review }: { review: CostReview }) {
  const { currency, amount } = review;
  const money = (minor: number) => formatMoney(minor, currency);
  const even = review.extraTakers.length === 0 && !review.uneven;
  const extra = extraSentence(review);
  const { original } = review;
  const originalMoney = (minor: number) => formatMoney(minor, original?.currency ?? currency);
  const fromOriginal = originalLine(review);
  const nothingChanged = review.changes.length === 0 && review.shareChanges.length === 0;

  return (
    <div className="grid gap-4">
      <h2 className="text-[19px]">{review.kind === "new" ? "Check this cost" : "Check your changes"}</h2>

      {review.kind === "new" ? (
        <>
          <p className="rounded-field bg-blue-soft px-4 py-3 text-[17px] font-bold text-blue-text wrap-anywhere">
            {who(review.payer)} paid {money(amount)}, split {review.shares.length}{" "}
            {review.shares.length === 1 ? "way" : "ways"}
            {even ? ` = ${money(review.shares[0].amount)} each` : ""}
          </p>
          {fromOriginal ? <p className="text-[13px] text-muted tabular-nums wrap-anywhere">{fromOriginal}</p> : null}
          {review.withPhoto ? <p className="text-[13px] text-muted">With a receipt photo.</p> : null}
          <dl className="grid gap-1 text-[15px]">
            <div className="flex gap-2">
              <dt className="text-muted">What</dt>
              <dd className="min-w-0 font-bold wrap-anywhere">{review.description}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Category</dt>
              <dd className="font-bold">{costCategoryOf(review.category).label}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Date</dt>
              <dd className="font-bold">{dayLabel(review.spentOn)}</dd>
            </div>
          </dl>
          <ul className="grid gap-1 border-t border-line pt-3 text-[15px]">
            {review.shares.map((share) => (
              <li key={share.spotId} className="flex justify-between gap-3">
                <span className="grid min-w-0">
                  <span className="wrap-anywhere">{who(share)}</span>
                  {share.own !== null ? (
                    <span className="text-[13px] text-muted tabular-nums">
                      {share.own > 0 ? `${originalMoney(share.own)} own + ` : ""}
                      {originalMoney((share.originalAmount ?? share.amount) - share.own)} shared
                    </span>
                  ) : share.originalAmount !== null ? (
                    <span className="text-[13px] text-muted tabular-nums">{originalMoney(share.originalAmount)}</span>
                  ) : null}
                </span>
                <span className="tabular-nums">{money(share.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
              <span className="grid">
                Total
                {original ? (
                  <span className="text-[13px] font-normal text-muted tabular-nums">{originalMoney(original.amount)}</span>
                ) : null}
              </span>
              <span className="tabular-nums">{money(amount)}</span>
            </li>
          </ul>
        </>
      ) : (
        <>
          <ul className="grid gap-3 text-[15px]">
            {review.changes.map((change) => (
              <li key={change.field} className="grid gap-0.5">
                <span className="text-[13px] font-bold text-muted">{change.field === "main" ? `Amount in ${currency}` : FIELD_LABELS[change.field]}</span>
                <Before was={change.before} now={change.after} />
              </li>
            ))}
            {review.shareChanges.map((change) => (
              <li key={change.person.spotId} className="grid gap-0.5">
                <span className="text-[13px] font-bold text-muted">
                  {change.person.isYou ? "Your share" : `${change.person.name}'s share`}
                </span>
                <Before
                  was={change.before === null ? "not in it" : money(change.before)}
                  now={change.after === null ? "not in it" : money(change.after)}
                />
              </li>
            ))}
          </ul>
          <p className="text-[14px] text-muted">{nothingChanged ? "Nothing changed." : "Nothing else changed."}</p>
        </>
      )}

      {extra ? <p className="text-[13px] text-muted">{extra}</p> : null}
    </div>
  );
}
