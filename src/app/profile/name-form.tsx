"use client";

import { useActionState } from "react";
import { updateDisplayName, type NameFormState } from "./actions";

const initialState: NameFormState = { ok: false, message: "" };

export function NameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="name" className="text-sm font-medium">
        Display name
      </label>
      <input
        id="name"
        name="name"
        type="text"
        defaultValue={currentName}
        maxLength={40}
        required
        className="min-h-11 rounded-lg border border-neutral-300 bg-white px-3 text-base text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus-visible:outline-neutral-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <p
        aria-live="polite"
        className={`min-h-5 text-sm ${state.ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
