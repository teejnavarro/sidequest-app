import { Suspense } from "react";
import Link from "next/link";
import { GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { getOptionalUser } from "@/lib/current-user";
import { signInWithGoogle } from "@/app/actions";
import { primaryButton } from "@/components/ui";

const DEMO_FACES = [
  { initials: "BA", color: "bg-face-1" },
  { initials: "MI", color: "bg-face-2" },
  { initials: "JO", color: "bg-face-3" },
  { initials: "RI", color: "bg-face-4" },
];

async function SignInArea() {
  const user = await getOptionalUser();

  if (user) {
    return (
      <Link href="/trips" className={`${primaryButton} w-full`}>
        Go to My trips
      </Link>
    );
  }

  return (
    <form action={signInWithGoogle}>
      <button type="submit" className={`${primaryButton} w-full`}>
        <GoogleLogo size={20} weight="bold" aria-hidden="true" />
        Continue with Google
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <main className="mx-auto grid min-h-[70dvh] w-full max-w-[480px] flex-1 content-center gap-5 px-4 py-8 md:max-w-[640px]">
      <div className="flex" aria-hidden="true">
        {DEMO_FACES.map((face, i) => (
          <span
            key={face.initials}
            className={`grid size-[52px] place-items-center rounded-full border-2 border-bg text-base font-bold text-on-face ${face.color} ${i > 0 ? "-ml-3" : ""}`}
          >
            {face.initials}
          </span>
        ))}
      </div>
      <h1 className="text-[44px] leading-[1.05]">Sidequest</h1>
      <p className="text-[17px]">
        Plan trips together and split costs without the awkward chats.
      </p>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="min-h-12 w-full animate-pulse rounded-full bg-chip"
          />
        }
      >
        <SignInArea />
      </Suspense>
    </main>
  );
}
