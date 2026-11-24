import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getQrForViewer: vi.fn(), readImage: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/payments", () => ({ getQrForViewer: mocks.getQrForViewer }));
vi.mock("@/lib/blob-store", () => ({ readImage: mocks.readImage }));

const call = () =>
  GET(new Request("http://localhost/profile/payment-details/a1/qr"), {
    params: Promise.resolve({ accountId: "a1" }),
  });

const imageOf = (bytes: number[]) => ({
  statusCode: 200,
  stream: new Response(new Uint8Array(bytes)).body!,
  blob: { contentType: "image/jpeg" },
});

describe("GET payment details QR", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben", image: null });
  });

  it("gives an allowed viewer the image with private, no-store and nosniff headers", async () => {
    mocks.getQrForViewer.mockResolvedValue("qr/a.jpg");
    mocks.readImage.mockResolvedValue(imageOf([0xff, 0xd8, 0xff, 1]));
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("Location")).toBeNull();
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 1]);
    expect(mocks.getQrForViewer).toHaveBeenCalledWith("a1", "u1");
    expect(mocks.readImage).toHaveBeenCalledWith("qr/a.jpg");
  });

  it("gives a stranger or a person who left the same 404, and never reads the file", async () => {
    mocks.getQrForViewer.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(response.headers.get("Content-Type")).not.toContain("image");
    expect(mocks.readImage).not.toHaveBeenCalled();
  });

  it("gives the same 404 when the file is missing from the store", async () => {
    mocks.getQrForViewer.mockResolvedValue("qr/gone.jpg");
    mocks.readImage.mockResolvedValue(null);
    const missing = await call();
    mocks.getQrForViewer.mockResolvedValue(null);
    const refused = await call();
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe(await refused.text());
    expect([...missing.headers].sort()).toEqual([...refused.headers].sort());
  });
});
