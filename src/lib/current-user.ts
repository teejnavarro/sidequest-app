import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type CurrentUser = { id: string; name: string; image: string | null };

// Who is signed in, or null. Never returns email, tokens or the raw session.
// Fresh lookup, for Server Actions and route handlers.
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, image } = session.user;
  return { id, name, image: image ?? null };
}

// Same lookup, kept in browser memory for pages and layouts.
export async function getOptionalUserForPage(): Promise<CurrentUser | null> {
  "use cache: private";
  // Next.js prepares the next page ahead of a tap and only waits for cached
  // reads. This keeps the lookup in browser memory only; sign-out clears it.
  // Pages only; actions and routes must use the fresh version so Better Auth
  // can renew the sign-in cookie.
  return getOptionalUser();
}

// The real check for protected actions and routes: sends signed-out visitors home.
// Fresh lookup, for Server Actions and route handlers.
export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await getOptionalUser();
  if (!user) redirect("/");
  return user;
}

// The real check for protected pages and layouts (the redirect stays outside the cache).
export async function getCurrentUserForPage(): Promise<CurrentUser> {
  const user = await getOptionalUserForPage();
  if (!user) redirect("/");
  return user;
}
