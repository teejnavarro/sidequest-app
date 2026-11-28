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
// in a phone frame, cropped at the bottom edge. Nothing here is above the first screen, so the
// image loads lazily (next/image's default).
export function StoryStep({ step }: { step: Step }) {
  return (
    <Ticket
      className="story-reveal md:min-h-[380px]"
      mainClass="grid content-center justify-items-start gap-3 p-5 md:flex-1 md:p-8"
      sideClass="flex items-end justify-center bg-chip px-4 pt-6 md:w-[380px] md:shrink-0"
      main={
        <>
          <span className={softTag}>Step {step.number}</span>
          <h3 className="text-2xl md:text-[34px]">{step.headline}</h3>
          <p className="text-muted">{step.line}</p>
        </>
      }
      side={
        <div className="h-[280px] w-[236px] overflow-hidden rounded-t-[28px] border-[6px] border-b-0 border-ink bg-card md:h-[330px] md:w-[270px]">
          <Image
            src={step.image}
            alt={step.alt}
            sizes="(min-width: 768px) 270px, 236px"
            placeholder="blur"
            className="size-full object-cover object-top"
          />
        </div>
      }
    />
  );
}
