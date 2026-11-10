"use client";

import { useActionState, useState } from "react";
import { joinTripAction, type JoinFormState } from "../actions";
import { Face } from "@/components/face";
import { errorClass, focusRing, helpClass, primaryButton } from "@/components/ui";

const initialState: JoinFormState = { message: "" };

export type UnclaimedGuest = { id: string; name: string };

const option = `flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-field border border-line bg-card px-3 py-2 has-checked:border-2 has-checked:border-blue-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-text`;
const radio = "size-[18px] shrink-0 accent-blue-text";

// The Join trip button. When the trip has guests nobody has claimed, it first asks whether
// the person is one of them, so they can take over that spot. Nothing is pre-selected, and
// the button reads "Join trip" until a name is picked (and always without JavaScript).
export function JoinForm({ code, guests = [] }: { code: string; guests?: UnclaimedGuest[] }) {
  const [state, formAction, pending] = useActionState(joinTripAction, initialState);
  const [claim, setClaim] = useState("");
  const picked = guests.find((guest) => guest.id === claim);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="code" value={code} />
      {guests.length > 0 ? (
        <fieldset className="grid min-w-0 gap-2 border-0 p-0">
          <legend className="mb-1 p-0 font-display text-[17px] font-bold">
            Are you already on this trip as a guest?
          </legend>
          {guests.map((guest) => (
            <label key={guest.id} className={option}>
              <input
                type="radio"
                name="claim"
                value={guest.id}
                onChange={() => setClaim(guest.id)}
                className={`${radio} ${focusRing}`}
              />
              <Face userId={guest.id} name={guest.name} image={null} size={28} decorative neutral />
              <span className="min-w-0 wrap-anywhere">Yes, I&apos;m {guest.name}</span>
            </label>
          ))}
          <label className={option}>
            <input
              type="radio"
              name="claim"
              value="new"
              onChange={() => setClaim("new")}
              className={`${radio} ${focusRing}`}
            />
            <span className="min-w-0">No, I&apos;m new to this trip</span>
          </label>
          <p className={helpClass}>Picking your name keeps everything already added for you.</p>
        </fieldset>
      ) : null}
      <button type="submit" disabled={pending} className={`${primaryButton} min-w-0 w-full`}>
        <span className="min-w-0 truncate">
          {pending ? "Joining…" : picked ? `Join as ${picked.name}` : "Join trip"}
        </span>
      </button>
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {state.message}
      </p>
    </form>
  );
}
