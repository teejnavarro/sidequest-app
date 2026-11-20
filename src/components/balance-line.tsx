import { Check } from "@phosphor-icons/react/dist/ssr";
import { formatMoney } from "@/lib/money";

// The viewer's own balance in words: "You're owed ₱1,250.00" (green), "You owe ₱400.00"
// (red) or "All settled" with a check. Color never carries the meaning alone. Used on the
// Costs tab and on My trips cards; `className` sets the size.
export function BalanceLine({
  net,
  currency,
  className = "",
}: {
  net: number;
  currency: string;
  className?: string;
}) {
  if (net === 0) {
    return (
      <p className={`flex items-center gap-1.5 font-bold ${className}`}>
        All settled
        <Check size={20} weight="bold" aria-hidden="true" />
      </p>
    );
  }
  const owed = net > 0;
  return (
    <p className={`font-bold tabular-nums wrap-anywhere ${owed ? "text-owed" : "text-owe"} ${className}`}>
      {owed ? "You're owed" : "You owe"} {formatMoney(Math.abs(net), currency)}
    </p>
  );
}
