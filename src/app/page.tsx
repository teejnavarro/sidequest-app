import { Suspense } from "react";
import { connection } from "next/server";
import { checkDatabase } from "@/lib/db-health";

async function DatabaseStatus() {
  await connection(); // run at request time, never at build time
  const { ok, ms } = await checkDatabase();

  return (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      {ok ? `Database connected ✓ (${ms} ms)` : "Database not connected"}
    </p>
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
