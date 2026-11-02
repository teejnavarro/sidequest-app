"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function signInWithGoogle() {
  const result = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/trips" },
    headers: await headers(),
  });
  if (!result.url) redirect("/");
  redirect(result.url);
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
