"use client";

import { useActionState } from "react";
import type { MemberFormState } from "@/lib/member-form-state";
import { dangerButton, errorClass, primaryButton, quietButton } from "@/components/ui";

const tones = { primary: primaryButton, quiet: quietButton, danger: dangerButton };

// The one button of a confirm page (Make owner, Remove member, New invite link, Leave trip):
// a small form that runs a server action with the ids it was given and shows the action's
// error under the button. The ids only say WHICH trip or person; the server decides who may.
export function ConfirmForm({
  action,
  fields,
  label,
  pendingLabel,
  tone,
}: {
  action: (prev: MemberFormState, formData: FormData) => Promise<MemberFormState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  tone: keyof typeof tones;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={`${tones[tone]} w-full`}>
        {pending ? pendingLabel : label}
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.error}
      </p>
    </form>
  );
}
