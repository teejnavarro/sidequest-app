import "server-only";
import { del, get, put } from "@vercel/blob";

// The only place that talks to Vercel Blob. QR codes and receipts live in a PRIVATE store:
// nothing here gives out a link, so every image is read through a route that first checks
// who is asking (see src/lib/payments.ts). Pages and actions never import @vercel/blob.
// The token comes from BLOB_READ_WRITE_TOKEN (local) or Vercel's own sign-in (deployed).

export type ImageFolder = "qr" | "receipts";

// Saves a JPEG under a new random name and returns that name (the pathname), like "qr/<uuid>.jpg".
export async function putImage(folder: ImageFolder, bytes: Uint8Array): Promise<string> {
  const result = await put(`${folder}/${crypto.randomUUID()}.jpg`, Buffer.from(bytes), {
    access: "private",
    contentType: "image/jpeg",
    addRandomSuffix: false,
  });
  return result.pathname;
}

// The image, or null when it is not there (or the store can't be reached).
export async function readImage(pathname: string) {
  try {
    const result = await get(pathname, { access: "private" });
    return result && result.statusCode === 200 ? result : null;
  } catch {
    return null;
  }
}

// Removes files. A file left behind is harmless and a failed page is not, so a failure is
// logged as a fixed code only: never a pathname or a token.
export async function deleteImages(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0) return;
  try {
    await del(pathnames);
  } catch {
    console.error("blob-delete-failed");
  }
}
