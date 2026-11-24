import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, readJpegUpload } from "./image-file";

const jpegBytes = (length: number): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(length);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
};
const file = (bytes: Uint8Array<ArrayBuffer>, name = "a.jpg") => new File([bytes], name, { type: "image/jpeg" });

describe("readJpegUpload", () => {
  it("refuses a missing value and a plain string", async () => {
    expect((await readJpegUpload(null)).ok).toBe(false);
    expect((await readJpegUpload("photo.jpg")).ok).toBe(false);
  });

  it("refuses an empty file", async () => {
    expect((await readJpegUpload(file(new Uint8Array(0)))).ok).toBe(false);
  });

  it("refuses a file over 900 KB and accepts exactly 900 KB", async () => {
    expect((await readJpegUpload(file(jpegBytes(MAX_IMAGE_BYTES + 1)))).ok).toBe(false);
    expect((await readJpegUpload(file(jpegBytes(MAX_IMAGE_BYTES)))).ok).toBe(true);
  });

  it("refuses PNG bytes even with a .jpg name and a JPEG type", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await readJpegUpload(file(png, "a.jpg"))).ok).toBe(false);
  });

  it("returns the bytes of a valid JPEG", async () => {
    const result = await readJpegUpload(file(jpegBytes(10)));
    expect(result).toEqual({ ok: true, bytes: jpegBytes(10) });
  });
});
