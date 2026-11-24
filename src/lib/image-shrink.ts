// Shrinks a picked picture on the phone before it uploads: at most 1280 pixels on the long
// side, re-saved as a JPEG. Re-saving also drops the hidden data in a photo, such as where it
// was taken. Client only (it needs the browser's image tools). Kept tiny and not unit-tested.

export class ImageReadError extends Error {}

const MAX_BYTES = 800 * 1024; // the server accepts up to 900 KB

export async function shrinkImage(
  file: File,
  { maxEdge = 1280, quality = 0.88 }: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageReadError("unreadable image");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageReadError("no canvas");
  // A JPEG has no see-through parts: paint white first so a transparent PNG doesn't go black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Lower the quality a step at a time if a busy picture is still too big.
  for (const q of [quality, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
    if (!blob) throw new ImageReadError("could not save");
    if (blob.size <= MAX_BYTES || q === 0.45) {
      return new File([blob], "image.jpg", { type: "image/jpeg" });
    }
  }
  throw new ImageReadError("too big");
}
