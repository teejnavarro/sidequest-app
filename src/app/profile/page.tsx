import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { signOut } from "@/app/actions";
import { NameForm } from "./name-form";

async function ProfileContent() {
  const user = await getCurrentUser();

  return (
    <>
      {user.image ? (
        <Image
          src={user.image}
          alt="Your profile photo"
          width={64}
          height={64}
          className="size-16 rounded-full"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-neutral-200 text-2xl font-semibold dark:bg-neutral-800"
        >
          {Array.from(user.name)[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <NameForm currentName={user.name} />
      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100"
        >
          Sign out
        </button>
      </form>
    </>
  );
}

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <Suspense
        fallback={
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Loading…
          </p>
        }
      >
        <ProfileContent />
      </Suspense>
      <Link
        href="/trips"
        className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Back to My trips
      </Link>
    </main>
  );
}
