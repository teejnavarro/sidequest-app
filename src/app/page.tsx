import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { checkDatabase } from "@/lib/db-health";
import { getOptionalUser } from "@/lib/current-user";
import { signInWithGoogle } from "@/app/actions";

async function DatabaseStatus() {
  await connection(); // run at request time, never at build time
  const { ok, ms } = await checkDatabase();

  return (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      {ok ? `Database connected ✓ (${ms} ms)` : "Database not connected"}
    </p>
  );
}

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100";

async function SignInArea() {
  const user = await getOptionalUser();

  if (user) {
    return (
      <Link href="/trips" className={buttonClass}>
        Go to My trips
      </Link>
    );
  }

  return (
    <form action={signInWithGoogle}>
      <button type="submit" className={buttonClass}>
        Continue with Google
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Sidequest</h1>
      <p className="max-w-sm text-lg text-neutral-700 dark:text-neutral-300">
        Plan trips together. Split costs without the awkward chats.
      </p>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="min-h-11 w-52 rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
          />
        }
      >
        <SignInArea />
      </Suspense>
      <Suspense
        fallback={
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Checking database…
          </p>
        }
      >
        <DatabaseStatus />
      </Suspense>
    </main>
  );
}
