"use client";

import { useActionState } from "react";
import { joinTripAction, type JoinFormState } from "../actions";
import { errorClass, primaryButton } from "@/components/ui";

const initialState: JoinFormState = { message: "" };

export function JoinForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(joinTripAction, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="code" value={code} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Joining…" : "Join trip"}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.message}
      </p>
    </form>
  );
}
