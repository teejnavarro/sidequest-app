import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { Ticket } from "@/components/home/ticket";
import { quietButton, softTag } from "@/components/ui";

export const GITHUB_URL = "https://github.com/teejnavarro/sidequest-app";

const TOOLS = [
  { label: "The app", tool: "Next.js + TypeScript", note: "Every screen and button" },
  { label: "The look", tool: "Tailwind + Phosphor icons", note: "Colors, type and icons" },
  { label: "The data", tool: "Postgres on Neon + Drizzle", note: "Trips and money, to the centavo" },
  { label: "Sign-in", tool: "Better Auth + Google", note: "No passwords to keep" },
  { label: "Hosting", tool: "Vercel", note: "The live site and private image storage" },
  { label: "Testing", tool: "Vitest", note: "Automated checks on every change" },
];

const card = "grid content-start gap-0.5 rounded-xl px-3.5 py-3";
const cardLabel = "text-[11px] font-bold tracking-wider text-blue-text uppercase";
const cardTool = "font-display text-base font-bold";
const cardNote = "text-[13px] text-muted";

// The tools behind the app, with a link to the public code. No name on purpose.
export function HowItsBuilt() {
  return (
    <Ticket
      className="story-reveal"
      mainClass="grid content-center justify-items-start gap-3 p-5 md:flex-[1.1] md:p-8"
      sideClass="bg-chip p-5 md:flex-[1.3] md:p-8"
      main={
        <>
          <span className={softTag}>Behind the scenes</span>
          <h2 className="text-2xl md:text-[34px]">How it&apos;s built</h2>
          <p className="text-muted">Free tools and services, so it runs for ₱0 a month. The code is public.</p>
          <a href={GITHUB_URL} className={`${quietButton} mt-1`}>
            <GithubLogo size={20} weight="bold" aria-hidden="true" />
            See the code on GitHub
          </a>
        </>
      }
      side={
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {TOOLS.map((item) => (
            <li key={item.label} className={`${card} bg-card`}>
              <span className={cardLabel}>{item.label}</span>
              <span className={cardTool}>{item.tool}</span>
              <span className={cardNote}>{item.note}</span>
            </li>
          ))}
          <li className={`${card} bg-blue-soft sm:col-span-2`}>
            <span className={cardLabel}>Made with</span>
            <span className={cardTool}>Claude Code</span>
            <span className={cardNote}>
              AI agents that planned, wrote and tested much of the code, with a person approving every step
            </span>
          </li>
        </ul>
      }
    />
  );
}
