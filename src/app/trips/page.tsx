import { Suspense } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";

async function TripsContent() {
  const user = await getCurrentUser();

  return (
    <>
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <span>Signed in as {user.name}</span>
        <Link
          href="/profile"
          className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Profile
        </Link>
      </p>
      <p className="text-neutral-700 dark:text-neutral-300">
        No trips yet. Creating trips comes next.
      </p>
    </>
  );
}

export default function TripsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My trips</h1>
      <Suspense
        fallback={
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Loading…
          </p>
        }
      >
        <TripsContent />
      </Suspense>
    </main>
  );
}
