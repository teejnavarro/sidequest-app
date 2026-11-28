import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Compass, ShieldCheck, SignOut } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUserForPage } from "@/lib/current-user";
import { signOut } from "@/app/actions";
import { Face } from "@/components/face";
import { TaskBand } from "@/components/task-band";
import { cardClass, focusRing, quietButton, screenClass, skeleton } from "@/components/ui";
import { NameForm } from "./name-form";
import { PaymentDetailsCard } from "./payment-details-card";

async function ProfileContent() {
  const user = await getCurrentUserForPage();

  return (
    <>
      <div className={`${cardClass} gap-4`}>
        <Face userId={user.id} name={user.name} image={user.image} size={72} />
        <NameForm currentName={user.name} />
      </div>
      <PaymentDetailsCard userId={user.id} />
      <form action={signOut}>
        <button type="submit" className={`${quietButton} w-full`}>
          <SignOut size={20} weight="bold" aria-hidden="true" />
          Sign out
        </button>
      </form>
      <div className="grid">
        <Link
          href="/"
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-bold text-blue-text underline underline-offset-2 ${focusRing}`}
        >
          <Compass size={18} weight="bold" aria-hidden="true" />
          How Sidequest works
        </Link>
        <Link
          href="/privacy"
          className={`inline-flex min-h-11 items-center justify-center gap-1.5 text-sm font-bold text-blue-text underline underline-offset-2 ${focusRing}`}
        >
          <ShieldCheck size={18} weight="bold" aria-hidden="true" />
          Privacy note
        </Link>
        <Link
          href="/profile/delete"
          className={`inline-flex min-h-11 items-center justify-center text-sm font-bold text-owe underline underline-offset-2 ${focusRing}`}
        >
          Delete my account
        </Link>
      </div>
    </>
  );
}

function ProfileLoading() {
  return (
    <div aria-hidden="true" className="grid gap-4">
      <div className={`h-64 ${skeleton} rounded-card bg-chip`} />
      <div className={`h-56 ${skeleton} rounded-card bg-chip`} />
      <div className={`h-12 ${skeleton} rounded-full bg-chip`} />
    </div>
  );
}

export const metadata: Metadata = { title: "Profile | Sidequest" };

export default function ProfilePage() {
  return (
    <>
      <TaskBand backHref="/trips" backLabel="My trips" title="Profile" />
      <main className={screenClass}>
        <Suspense fallback={<ProfileLoading />}>
          <ProfileContent />
        </Suspense>
      </main>
    </>
  );
}
