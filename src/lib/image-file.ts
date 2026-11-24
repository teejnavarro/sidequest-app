// The server's check on an uploaded image (QR code or receipt). The phone shrinks the photo to
// a JPEG first; the server never trusts that and checks again: a real file, not empty, small
// enough, and JPEG bytes (not just a JPEG file name). Pure apart from reading the file.

export const MAX_IMAGE_BYTES = 900 * 1024;

export type JpegUpload =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string };

export async function readJpegUpload(value: FormDataEntryValue | null): Promise<JpegUpload> {
  if (!(value instanceof File)) return { ok: false, error: "Choose an image." };
  if (value.size === 0) return { ok: false, error: "That image is empty. Choose another." };
  if (value.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "That image is too big. Choose a smaller one." };
  }
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return { ok: false, error: "That isn't a JPEG image. Choose another." };
  }
  return { ok: true, bytes };
}
