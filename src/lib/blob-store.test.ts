import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const put = vi.fn();
const get = vi.fn();
const del = vi.fn();
vi.mock("@vercel/blob", () => ({ put, get, del }));

const { putImage, readImage, deleteImages } = await import("./blob-store");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("putImage", () => {
  it("saves a private JPEG under a random name in the folder and returns the pathname", async () => {
    put.mockImplementation(async (pathname: string) => ({ pathname }));
    const qr = await putImage("qr", new Uint8Array([0xff, 0xd8, 0xff]));
    const receipt = await putImage("receipts", new Uint8Array([0xff, 0xd8, 0xff]));
    expect(qr).toMatch(/^qr\/[0-9a-f-]{36}\.jpg$/);
    expect(receipt).toMatch(/^receipts\/[0-9a-f-]{36}\.jpg$/);
    expect(qr).not.toBe(receipt);
    expect(put).toHaveBeenCalledWith(qr, expect.any(Buffer), {
      access: "private",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
  });

  it("passes the bytes through unchanged", async () => {
    put.mockImplementation(async (pathname: string) => ({ pathname }));
    await putImage("qr", new Uint8Array([1, 2, 3]));
    expect([...(put.mock.calls[0]![1] as Buffer)]).toEqual([1, 2, 3]);
  });
});

describe("readImage", () => {
  it("asks for the private file and returns the result", async () => {
    const found = { statusCode: 200, stream: {}, blob: { contentType: "image/jpeg" } };
    get.mockResolvedValue(found);
    expect(await readImage("qr/a.jpg")).toBe(found);
    expect(get).toHaveBeenCalledWith("qr/a.jpg", { access: "private" });
  });

  it("returns null when the file is missing, unchanged, or the store fails", async () => {
    get.mockResolvedValueOnce(null);
    expect(await readImage("qr/a.jpg")).toBeNull();
    get.mockResolvedValueOnce({ statusCode: 304, stream: null });
    expect(await readImage("qr/a.jpg")).toBeNull();
    get.mockRejectedValueOnce(new Error("down"));
    expect(await readImage("qr/a.jpg")).toBeNull();
  });
});

describe("deleteImages", () => {
  it("does nothing for an empty list", async () => {
    await deleteImages([]);
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes the given pathnames", async () => {
    del.mockResolvedValue(undefined);
    await deleteImages(["qr/a.jpg", "receipts/b.jpg"]);
    expect(del).toHaveBeenCalledWith(["qr/a.jpg", "receipts/b.jpg"]);
  });

  it("swallows a failure and logs only a fixed code, never a pathname", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    del.mockRejectedValue(new Error("token abc for qr/secret.jpg"));
    await expect(deleteImages(["qr/secret.jpg"])).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/secret|token|qr\//);
    error.mockRestore();
  });
});
