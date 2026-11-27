"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, MagnifyingGlassPlus } from "@phosphor-icons/react/dist/ssr";
import { addCostPhotoAction } from "@/app/trips/[tripId]/costs/actions";
import type { CostPhotoState } from "@/lib/cost-form-state";
import { ImageReadError, shrinkImage } from "@/lib/image-shrink";
import { errorClass, focusRing } from "@/components/ui";

const FAILED = "Couldn't add the photo. Try again with a smaller picture or better signal.";
const box = "size-[72px] shrink-0 rounded-[12px]";

// The receipt photo box on the Cost page, in the hero's grid (the error takes a row under it).
// Empty: tap to pick or take a photo; it is shrunk on the phone and sent right away, no Edit
// needed. With a photo: a thumbnail that opens the full picture in a new tab. `photoSrc` is the
// checked route's address, never a storage path.
export function CostPhotoBox({ tripId, costId, photoSrc }: { tripId: string; costId: string; photoSrc: string | null }) {
  const [state, formAction, pending] = useActionState<CostPhotoState, FormData>(addCostPhotoAction, {});
  const [preparing, setPreparing] = useState(false);
  const [readError, setReadError] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const error = readError ? FAILED : (state.error ?? null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    // React clears event.currentTarget once the handler awaits, so keep the input itself.
    const picker = event.currentTarget;
    const file = picker.files?.[0];
    if (!file) return;
    setPreparing(true);
    setReadError(false);
    try {
      const small = await shrinkImage(file);
      const transfer = new DataTransfer();
      transfer.items.add(small);
      picker.files = transfer.files;
      form.current?.requestSubmit();
    } catch (problem) {
      picker.value = "";
      if (!(problem instanceof ImageReadError)) console.error("image-shrink-failed");
      setReadError(true);
    } finally {
      setPreparing(false);
    }
  }

  const busy = pending || preparing;

  return (
    <>
      {photoSrc ? (
        <a
          href={photoSrc}
          target="_blank"
          rel="noopener"
          className={`relative block ${box} border border-line ${focusRing}`}
          aria-label="Open the receipt photo"
        >
          {/* The photo is served by a route that checks who is asking; next/image would copy it through the optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc} alt="Receipt photo" className={`${box} bg-chip object-cover`} />
          <span
            aria-hidden="true"
            className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-card text-ink"
          >
            <MagnifyingGlassPlus size={12} weight="bold" />
          </span>
        </a>
      ) : (
        <form ref={form} action={formAction} className="contents">
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="costId" value={costId} />
          <input
            ref={input}
            type="file"
            name="photo"
            accept="image/*"
            onChange={onPick}
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          {busy ? (
            <div
              aria-busy="true"
              className={`grid ${box} place-items-center bg-chip text-center text-[11px] font-bold text-muted`}
            >
              Adding…
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={`grid ${box} place-items-center content-center gap-0.5 border-2 border-dashed border-line text-[11px] font-bold text-blue-text ${focusRing}`}
            >
              <Camera size={22} weight="bold" aria-hidden="true" />
              Add photo
            </button>
          )}
        </form>
      )}
      <p role="alert" className={`${errorClass} col-span-3 empty:hidden`}>
        {error}
      </p>
    </>
  );
}
