import { Suspense } from "react";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { getCurrentUser } from "@/lib/current-user";
import { signOut } from "@/app/actions";
import { Face } from "@/components/face";
import { TaskBand } from "@/components/task-band";
import { cardClass, quietButton, screenClass, skeleton } from "@/components/ui";
import { NameForm } from "./name-form";

async function ProfileContent() {
  const user = await getCurrentUser();

  return (
    <>
      <div className={`${cardClass} gap-4`}>
        <Face userId={user.id} name={user.name} image={user.image} size={72} />
        <NameForm currentName={user.name} />
      </div>
      <form action={signOut}>
        <button type="submit" className={`${quietButton} w-full`}>
          <SignOut size={20} weight="bold" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </>
  );
}

function ProfileLoading() {
  return (
    <div aria-hidden="true" className="grid gap-4">
      <div className={`h-64 ${skeleton} rounded-card bg-chip`} />
      <div className={`h-12 ${skeleton} rounded-full bg-chip`} />
    </div>
  );
}

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
