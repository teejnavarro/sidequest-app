import { Suspense } from "react";
import type { Metadata } from "next";
import { getOptionalUserForPage } from "@/lib/current-user";
import { TaskBand } from "@/components/task-band";
import { cardClass, screenClass } from "@/components/ui";

// Public on purpose (outside the proxy matcher): people read it before signing in, and
// Google asks for a public link before the sign-in app is published. The words are static;
// only the back link depends on who is looking, so only it waits inside Suspense.
async function PrivacyBand() {
  const user = await getOptionalUserForPage();
  return user ? (
    <TaskBand backHref="/profile" backLabel="Profile" title="Privacy note" />
  ) : (
    <TaskBand backHref="/" backLabel="Sidequest" title="Privacy note" />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} gap-2 px-5 py-4`}>
      <h2 className="text-[19px]">{title}</h2>
      {children}
    </section>
  );
}

const listClass = "grid list-disc gap-1.5 pl-5";

export const metadata: Metadata = { title: "Privacy note | Sidequest" };

export default function PrivacyPage() {
  return (
    <>
      <Suspense fallback={<TaskBand backHref="/" backLabel="Sidequest" title="Privacy note" />}>
        <PrivacyBand />
      </Suspense>
      <main className={screenClass}>
        <Section title="What Sidequest keeps">
          <ul className={listClass}>
            <li>From Google: your name, email and photo. Nothing else.</li>
            <li>What you add to trips: ideas, votes, the schedule, costs and payments.</li>
            <li>Payment details and QR images you save, and receipts you add.</li>
          </ul>
        </Section>
        <Section title="Who sees it">
          <ul className={listClass}>
            <li>Only people in a trip see that trip.</li>
            <li>Your payment details: only people in a trip with you right now.</li>
            <li>A receipt: only the person who paid and the person paid.</li>
            <li>
              A receipt photo on a cost: everyone in the trip right now. It stays with the trip if the person who
              added it deletes their account.
            </li>
            <li>Your email: nobody. It&apos;s only used to sign you in.</li>
          </ul>
        </Section>
        <Section title="Where it lives">
          <p>
            On Vercel (the website) and Neon (the database). Images are in private storage and only open after
            the app checks who you are. Sidequest never sells or shares your data, and has no ads or trackers.
          </p>
        </Section>
        <Section title="Deleting your account">
          <p>
            Go to Profile, then Delete my account. Your name, email, photo, payment details and your receipts
            are deleted. Costs and payments you were part of stay in the trip as &quot;Former member&quot;, so
            your friends&apos; balances still add up. Signing in again later starts a new, empty account.
          </p>
        </Section>
        <p className="text-[13px] text-muted">
          Questions? Ask the person who invited you, or Sidequest&apos;s maker on{" "}
          <a
            href="https://github.com/teejnavarro/sidequest-app"
            className="font-bold text-blue-text underline underline-offset-2"
          >
            GitHub
          </a>
          .
        </p>
        <p className="text-[13px] text-muted">Updated 27 November 2026.</p>
      </main>
    </>
  );
}
