import { Airplane } from "@phosphor-icons/react/dist/ssr";

// Start date, a dashed line with a plane exactly in the middle, end date.
// Three columns (1fr, auto, 1fr) keep the plane centered whatever the date text length.
export function RouteLine({ start, end }: { start: string; end: string }) {
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 text-[13px] whitespace-nowrap text-muted tabular-nums">
      <span className="flex min-w-0 items-center gap-1.5">
        {start}
        <i className="min-w-3 flex-1 border-t-2 border-dashed border-line" aria-hidden="true" />
      </span>
      <Airplane
        size={20}
        weight="bold"
        aria-hidden="true"
        className="rotate-90 text-pin"
      />
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <i className="min-w-3 flex-1 border-t-2 border-dashed border-line" aria-hidden="true" />
        {end}
      </span>
    </span>
  );
}
