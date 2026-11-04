"use client";

import { useActionState } from "react";
import { updateDisplayName, type NameFormState } from "./actions";
import {
  helpClass,
  inputClass,
  labelClass,
  primaryButton,
} from "@/components/ui";

const initialState: NameFormState = { ok: false, message: "" };

export function NameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayName,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={currentName}
          maxLength={40}
          required
          aria-describedby="name-help name-message"
          className={inputClass}
        />
        <span id="name-help" className={helpClass}>
          This is the name your group sees.
        </span>
      </div>
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Saving…" : "Save"}
      </button>
      <p
        id="name-message"
        aria-live="polite"
        className={`text-[13px] font-bold empty:sr-only ${state.ok ? "text-owed" : "text-owe"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
