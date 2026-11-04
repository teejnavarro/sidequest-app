"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/current-user";
import { validateDisplayName } from "@/lib/display-name";

export type NameFormState = { ok: boolean; message: string };

export async function updateDisplayName(
  _prev: NameFormState,
  formData: FormData,
): Promise<NameFormState> {
  await getCurrentUser(); // never trust the client: re-check the session

  const result = validateDisplayName(formData.get("name"));
  if (!result.ok) return { ok: false, message: result.error };

  try {
    await auth.api.updateUser({
      body: { name: result.name },
      headers: await headers(),
    });
  } catch {
    return { ok: false, message: "Couldn't save your name. Please try again." };
  }

  revalidatePath("/profile");
  return { ok: true, message: "Saved." };
}
