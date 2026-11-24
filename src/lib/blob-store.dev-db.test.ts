import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// One real round trip against the PRIVATE dev Blob store: put, read back, check a plain
// request is refused (which also proves the store is private), delete, check it is gone.
// Run with: npm.cmd run test:dev-db
//
// Safety rules (the same spirit as the other dev-db tests):
// - The token comes from .env.development.local and nowhere else. No fallback: if that file
//   can't be used, the run stops before contacting anything.
// - Nothing prints the token, the store address or a file address.
// - The test only touches the one file it uploads, and deletes it afterwards.

vi.mock("server-only", () => ({}));

function devBlobToken(): string {
  let token: string | undefined;
  try {
    token = parseEnv(readFileSync(".env.development.local", "utf8")).BLOB_READ_WRITE_TOKEN;
  } catch {
    throw new Error("Stopped: could not load .env.development.local. Nothing was contacted.");
  }
  if (!token) {
    throw new Error("Stopped: no BLOB_READ_WRITE_TOKEN in .env.development.local. Nothing was contacted.");
  }
  return token;
}

// A tiny but valid JPEG (1x1 pixel).
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

describe("blob store on the dev store", () => {
  let store: typeof import("./blob-store");
  let pathname: string | undefined;

  beforeAll(async () => {
    process.env.BLOB_READ_WRITE_TOKEN = devBlobToken();
    store = await import("./blob-store");
  });

  afterAll(async () => {
    if (pathname) await store.deleteImages([pathname]);
  });

  it("stores, reads back, refuses a plain request, deletes", async () => {
    pathname = await store.putImage("qr", JPEG);
    expect(pathname).toMatch(/^qr\/[0-9a-f-]{36}\.jpg$/);

    const found = await store.readImage(pathname);
    expect(found).not.toBeNull();
    expect(found!.blob.contentType).toBe("image/jpeg");
    const bytes = new Uint8Array(await new Response(found!.stream).arrayBuffer());
    expect(bytes).toEqual(JPEG);

    // No token, no cookie: a private store must refuse. A 200 here means the store is public.
    const plain = await fetch(found!.blob.url);
    expect(plain.status === 200, "the dev Blob store is PUBLIC").toBe(false);
    expect(plain.ok).toBe(false);

    await store.deleteImages([pathname]);
    expect(await store.readImage(pathname)).toBeNull();
    pathname = undefined;
  });
});
