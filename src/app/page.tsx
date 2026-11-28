import { Suspense } from "react";
import Link from "next/link";
import { Airplane, GithubLogo, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { getOptionalUserForPage } from "@/lib/current-user";
import { signInWithGoogle } from "@/app/actions";
import { primaryButton, skeleton } from "@/components/ui";
import { RouteLine } from "@/components/route-line";
import { StoryMotion } from "@/components/home/story-motion";
import { Ticket } from "@/components/home/ticket";
import { StoryStep, type Step } from "@/components/home/story-step";
import { GITHUB_URL, HowItsBuilt } from "@/components/home/how-its-built";
import shotTrip from "./_home/shots/01-trip.png";
import shotInvite from "./_home/shots/02-invite.png";
import shotIdeas from "./_home/shots/03-ideas.png";
import shotSchedule from "./_home/shots/04-schedule.png";
import shotCosts from "./_home/shots/05-costs.png";
import shotPay from "./_home/shots/06-pay.png";

const DEMO_FACES = [
  { initials: "BA", color: "bg-face-1" },
  { initials: "MI", color: "bg-face-2" },
  { initials: "JO", color: "bg-face-3" },
  { initials: "RI", color: "bg-face-4" },
];

// The legs of the journey, each with its steps. The screenshots are of a made-up demo trip.
const LEGS: { id: string; label: string; title: string; steps: Step[] }[] = [
  {
    id: "before",
    label: "Leg 1",
    title: "Before the trip",
    steps: [
      {
        number: "01",
        headline: "Start a trip in a minute.",
        line: "Give it a name and dates, and the money's in pesos unless you say so.",
        image: shotTrip,
        alt: "Trip header for Siargao trip with its dates and four people going, above the Schedule tab",
      },
      {
        number: "02",
        headline: "One link for the group chat.",
        line: "Friends tap it and they're in. Friends who won't sign up can be added as guests.",
        image: shotInvite,
        alt: "Invite people screen with the link to share, four people in, and Rica marked as a guest",
      },
      {
        number: "03",
        headline: 'Every "we should totally go here" in one place.',
        line: "Add ideas, vote them up or down, and approve the ones you're doing.",
        image: shotIdeas,
        alt: "Ideas tab with Island hopping approved and three thumbs up",
      },
      {
        number: "04",
        headline: "One card per day, so nobody has to ask what time.",
        line: "Approved ideas drop into their day, in the trip's own time zone.",
        image: shotSchedule,
        alt: "Schedule tab with a card for each day, and Day 2 holding a morning, a 13:00 and an evening item",
      },
    ],
  },
  {
    id: "during",
    label: "Leg 2",
    title: "During the trip",
    steps: [
      {
        number: "05",
        headline: "Who paid, who owes, and no awkward chats about it.",
        line: "Log a cost in seconds. Split it evenly, or say what each person had.",
        image: shotCosts,
        alt: "Costs tab saying you're owed 6,400 pesos, with 24,700 pesos logged in 7 costs and the first cost rows",
      },
    ],
  },
  {
    id: "after",
    label: "Leg 3",
    title: "After the trip",
    steps: [
      {
        number: "06",
        headline: "Settle up with GCash, Maya or bank.",
        line: "Sidequest works out the fewest payments. Tap one to see their details and QR, then mark it paid.",
        image: shotPay,
        alt: "Pay page saying Jo pays Bea 550 pesos, with Bea's GCash name, number and QR code",
      },
    ],
  },
];

const STEP_COUNT = LEGS.reduce((count, leg) => count + leg.steps.length, 0);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const bandLink =
  "inline-flex min-h-11 items-center gap-1.5 text-sm text-band-muted underline underline-offset-2 hover:text-on-band";
const label = "text-xs font-bold tracking-wider text-muted uppercase";

function GoogleButton() {
  return (
    <form action={signInWithGoogle}>
      <button type="submit" className={`${primaryButton} w-full`}>
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        Continue with Google
      </button>
    </form>
  );
}

function ButtonSkeleton() {
  return <div aria-hidden="true" className={`min-h-12 w-full ${skeleton} rounded-full bg-chip`} />;
}

// The three parts below read the session, so each sits in its own Suspense. They share one
// cached lookup (getOptionalUserForPage), so three calls cost one.

async function TopAction() {
  const user = await getOptionalUserForPage();
  if (!user) return null;
  return (
    <Link
      href="/trips"
      className="inline-flex min-h-11 items-center rounded-full bg-on-band/15 px-4 text-sm font-bold text-on-band"
    >
      My trips
    </Link>
  );
}

async function HeroAction({ searchParams }: { searchParams: SearchParams }) {
  const [user, { deleted }] = await Promise.all([getOptionalUserForPage(), searchParams]);

  if (user) {
    return (
      <>
        <Link href="/trips" className={`${primaryButton} w-full`}>
          Go to My trips
        </Link>
        <p className="text-[13px] text-muted">Welcome back. Your trips are one tap away.</p>
      </>
    );
  }

  return (
    <>
      {deleted === "1" && <p className="text-[13px] text-muted">Your account is deleted.</p>}
      <GoogleButton />
      <p className="text-[13px] text-muted">Free. Sign in, start a trip, send the link.</p>
    </>
  );
}

async function LastStopAction() {
  const user = await getOptionalUserForPage();
  return (
    <>
      <h2 className="text-[28px] md:text-[40px]">{user ? "Back to planning?" : "Got a trip coming up?"}</h2>
      <p className="text-band-muted">
        {user ? "Your trips are where you left them." : "Start it here, then send the link to the group chat."}
      </p>
      <div className="mx-auto w-full max-w-sm pt-2">
        {user ? (
          <Link href="/trips" className={`${primaryButton} w-full`}>
            Go to My trips
          </Link>
        ) : (
          <GoogleButton />
        )}
      </div>
    </>
  );
}

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="flex-1">
      <StoryMotion />
      <header className="bg-band px-4 pb-[88px] text-on-band md:pb-[112px]">
        <div className="mx-auto w-full max-w-[480px] md:max-w-[1040px]">
          <div className="flex min-h-11 items-center justify-between pt-4">
            <span className="font-display text-xl font-bold">Sidequest</span>
            <Suspense fallback={<span aria-hidden="true" className="min-h-11" />}>
              <TopAction />
            </Suspense>
          </div>
          <div className="story-reveal grid gap-3 pt-8 md:pt-14">
            <h1 className="text-[40px] leading-[1.05] md:text-[64px]">Your trip, out of the group chat.</h1>
            <p className="text-lg text-band-muted md:max-w-[560px]">
              Plan trips together and split costs without the awkward chats.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-16 w-full max-w-[480px] px-4 md:-mt-[84px] md:max-w-[1040px]">
        <Ticket
          className="story-reveal shadow-sm"
          mainClass="grid content-start gap-4 p-5 md:flex-[1.6] md:p-8"
          sideClass="grid content-start gap-4 p-5 md:flex-1 md:p-8"
          main={
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={label}>From</p>
                  <p className="font-display text-xl font-bold">The group chat</p>
                </div>
                <div>
                  <p className={label}>To</p>
                  <p className="font-display text-xl font-bold">One plan</p>
                </div>
              </div>
              <RouteLine start="Ideas" end="Settled up" />
              <Suspense fallback={<ButtonSkeleton />}>
                <HeroAction searchParams={searchParams} />
              </Suspense>
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center justify-self-start text-[13px] text-muted underline underline-offset-2"
              >
                Privacy note
              </Link>
            </>
          }
          side={
            <>
              <div className="grid gap-2">
                <p className={label}>Passengers</p>
                <div className="flex items-center gap-3">
                  <div className="flex" aria-hidden="true">
                    {DEMO_FACES.map((face, i) => (
                      <span
                        key={face.initials}
                        className={`grid size-10 place-items-center rounded-full border-2 border-card text-xs font-bold text-on-face ${face.color} ${i > 0 ? "-ml-2.5" : ""}`}
                      >
                        {face.initials}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-muted">and your friends</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={label}>Stops</p>
                  <p className="font-display text-xl font-bold">{STEP_COUNT}</p>
                </div>
                <div>
                  <p className={label}>Boarding</p>
                  <p className="text-sm font-bold">Anyone with the link</p>
                </div>
              </div>
            </>
          }
        />
      </div>

      <div className="story-journey relative mx-auto mt-14 w-full max-w-[480px] px-4 md:mt-20 md:max-w-[1040px]">
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-[27px] border-l-2 border-dashed border-blue-text/50"
        />
        <div
          aria-hidden="true"
          className="story-plane absolute top-0 left-[13px] grid size-7 place-items-center rounded-full bg-bg"
        >
          <Airplane size={22} weight="bold" className="rotate-180 text-pin" />
        </div>
        <div className="grid gap-12">
          {LEGS.map((leg) => (
            <section key={leg.id} aria-labelledby={`leg-${leg.id}`} className="relative grid gap-5">
              <div className="story-reveal relative pl-11 md:pl-[60px]">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 left-1 size-3.5 rounded-full bg-amber ring-4 ring-bg"
                />
                <p className="text-xs font-bold tracking-wider text-blue-text uppercase">{leg.label}</p>
                <h2 id={`leg-${leg.id}`} className="text-[22px]">
                  {leg.title}
                </h2>
              </div>
              <div className="grid gap-5 pl-11 md:pl-[60px]">
                {leg.steps.map((step) => (
                  <StoryStep key={step.number} step={step} />
                ))}
              </div>
            </section>
          ))}
          <div className="relative pl-11 md:pl-[60px]">
            <HowItsBuilt />
          </div>
        </div>
      </div>

      <section className="mt-14 bg-band px-4 py-14 text-center text-on-band md:mt-20 md:py-20">
        <div className="story-reveal mx-auto grid max-w-[480px] gap-3 md:max-w-[640px]">
          <Suspense
            fallback={
              <>
                <h2 className="text-[28px] md:text-[40px]">Got a trip coming up?</h2>
                <div className="mx-auto w-full max-w-sm pt-2">
                  <ButtonSkeleton />
                </div>
              </>
            }
          >
            <LastStopAction />
          </Suspense>
          <div className="flex justify-center gap-6 pt-4">
            <Link href="/privacy" className={bandLink}>
              Privacy note
            </Link>
            <a href={GITHUB_URL} className={bandLink}>
              <GithubLogo size={18} weight="bold" aria-hidden="true" />
              GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
