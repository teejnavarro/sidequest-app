"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, QrCode } from "@phosphor-icons/react/dist/ssr";
import { ImageReadError, shrinkImage } from "@/lib/image-shrink";
import { errorClass, focusRing, helpClass, smallQuietButton } from "@/components/ui";

const icons = { qr: QrCode, image: ImageIcon, camera: Camera };
const READ_FAILED = "Couldn't read that image. Try a screenshot instead.";

// Picks one picture, shrinks it on the phone and puts the small JPEG back into the file box, so
// the form posts the small file. With a saved picture it shows a preview with Change and Remove;
// `actionName` then posts keep, replace or remove so the server knows which one it was.
// `onPreview` tells the form what is showing (for a review step). `form` ties both inputs to a
// form elsewhere on the page (by its id), so the picker can stay mounted while forms swap.
export function ImagePicker({
  name,
  actionName,
  savedSrc = null,
  icon,
  addLabel,
  help,
  previewAlt,
  onPreview,
  form,
}: {
  name: string;
  actionName?: string;
  savedSrc?: string | null;
  icon: keyof typeof icons;
  addLabel: string;
  help?: string;
  previewAlt: string;
  onPreview?: (src: string | null) => void;
  form?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = icons[icon];

  const showing = picked ?? (removed ? null : savedSrc);

  function show(next: string | null, nextRemoved: boolean) {
    if (picked) URL.revokeObjectURL(picked);
    setPicked(next);
    setRemoved(nextRemoved);
    onPreview?.(next ?? (nextRemoved ? null : savedSrc));
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const box = event.currentTarget;
    const file = box.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const small = await shrinkImage(file);
      const transfer = new DataTransfer();
      transfer.items.add(small);
      box.files = transfer.files;
      show(URL.createObjectURL(small), false);
    } catch (problem) {
      box.value = "";
      if (!(problem instanceof ImageReadError)) console.error("image-shrink-failed");
      setError(READ_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (input.current) input.current.value = "";
    setError(null);
    show(null, savedSrc !== null);
  }

  return (
    <div className="grid min-w-0 gap-2">
      <input
        ref={input}
        type="file"
        name={name}
        form={form}
        accept="image/*"
        onChange={onPick}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      {actionName ? (
        <input type="hidden" name={actionName} form={form} value={picked ? "replace" : removed ? "remove" : "keep"} />
      ) : null}

      {showing ? (
        <div className="flex min-w-0 items-center gap-3 rounded-field border border-line bg-card p-2">
          {/* A small preview of a local or saved image; next/image would route it through the optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={showing} alt={previewAlt} className="size-16 shrink-0 rounded-field bg-chip object-cover" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => input.current?.click()} className={smallQuietButton}>
              Change
            </button>
            <button type="button" onClick={remove} className={smallQuietButton}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-busy={busy}
          className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-field border-2 border-dashed border-muted bg-card px-4 text-[15px] font-bold text-ink ${focusRing}`}
        >
          <Icon size={22} weight="bold" aria-hidden="true" />
          {busy ? "Making it smaller…" : addLabel}
        </button>
      )}
      {help ? <span className={helpClass}>{help}</span> : null}
      <p role="alert" className={`${errorClass} empty:hidden`}>
        {error}
      </p>
    </div>
  );
}
