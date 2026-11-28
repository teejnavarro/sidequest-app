import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { Ticket } from "@/components/home/ticket";
import { quietButton, softTag } from "@/components/ui";

export const GITHUB_URL = "https://github.com/teejnavarro/sidequest-app";

const BUILT_WITH = [
  "Next.js",
  "TypeScript",
  "Postgres on Neon",
  "Drizzle",
  "Better Auth",
  "Tailwind",
  "Vitest",
  "Vercel",
];

// A short note from the maker, with a link to the public code. No name on purpose.
export function HowItsBuilt() {
  return (
    <Ticket
      className="story-reveal"
      mainClass="grid content-center justify-items-start gap-3 p-5 md:flex-[1.4] md:p-8"
      sideClass="grid content-center gap-3 border-line bg-chip p-5 md:flex-1 md:p-8"
      main={
        <>
          <span className={softTag}>How it&apos;s built</span>
          <h2 className="text-2xl md:text-[34px]">A note from the maker.</h2>
          <p className="text-muted">
            I work in data analytics, not software. I built Sidequest for my own barkada&apos;s next
            trip, with AI agents writing a lot of the code and me making every call.
          </p>
          <a href={GITHUB_URL} className={`${quietButton} mt-1`}>
            <GithubLogo size={20} weight="bold" aria-hidden="true" />
            See the code on GitHub
          </a>
        </>
      }
      side={
        <>
          <p className="text-[13px] font-bold text-muted">Built with</p>
          <ul className="flex flex-wrap gap-2">
            {BUILT_WITH.map((name) => (
              <li key={name} className="rounded-full bg-card px-3 py-1 text-[13px] font-bold text-ink">
                {name}
              </li>
            ))}
          </ul>
        </>
      }
    />
  );
}
