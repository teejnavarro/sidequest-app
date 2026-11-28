import Image, { type StaticImageData } from "next/image";
import { Ticket } from "@/components/home/ticket";
import { softTag } from "@/components/ui";

export type Step = {
  number: string; // "01"
  headline: string;
  line: string;
  image: StaticImageData;
  alt: string;
};

// One step of the walkthrough: the words, a tear line, then a real screenshot of the demo trip
// in a phone frame, cropped at the bottom edge. The frame is plain `chip` while it loads (no blur).
// Nothing here is above the first screen, so the
// image loads lazily (next/image's default).
export function StoryStep({ step }: { step: Step }) {
  return (
    <Ticket
      className="story-reveal md:min-h-[400px]"
      mainClass="grid content-center justify-items-start gap-3 p-5 md:flex-1 md:p-6 lg:p-8"
      sideClass="flex items-end justify-center bg-chip px-3 pt-6 md:w-[380px] md:shrink-0 lg:w-[420px]"
      main={
        <>
          <span className={softTag}>Step {step.number}</span>
          <h3 className="text-2xl md:text-[28px] lg:text-[34px]">{step.headline}</h3>
          <p className="text-muted">{step.line}</p>
        </>
      }
      side={
        <div className="h-[360px] w-[300px] max-w-full overflow-hidden rounded-t-[28px] border-[6px] border-b-0 border-ink bg-chip md:h-[420px] md:w-[340px]">
          <Image
            src={step.image}
            alt={step.alt}
            sizes="(min-width: 768px) 340px, 300px"
            quality={90}
            className="size-full object-cover object-top"
          />
        </div>
      }
    />
  );
}
