import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { Band } from "@/components/band";
import { linkClass, skeleton } from "@/components/ui";

// The short ocean header for pages where you do one job (edit, invite, delete, a new trip,
// your profile): a back link, then the title. No tab bar, no trip details.
export function TaskBand({
  backHref,
  backLabel,
  title,
}: {
  backHref: string;
  backLabel: string;
  title: string;
}) {
  return (
    <Band>
      <Link
        href={backHref}
        className={`${linkClass} max-w-full justify-self-start text-band-muted! no-underline focus-visible:outline-on-band`}
      >
        <CaretLeft size={20} weight="bold" aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 truncate">{backLabel}</span>
      </Link>
      <h1 className="text-[30px] break-words">{title}</h1>
    </Band>
  );
}

// The same shape while the page's data is on its way.
export function TaskBandLoading() {
  return (
    <div aria-hidden="true" className="bg-band">
      <div className="mx-auto grid max-w-[480px] gap-1 px-4 pt-5 pb-5 md:max-w-[640px]">
        <div className={`h-11 w-28 ${skeleton} rounded-full bg-on-band/20`} />
        <div className={`h-9 w-48 ${skeleton} rounded-full bg-on-band/20`} />
      </div>
    </div>
  );
}
