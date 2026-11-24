import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getReceiptForParty: vi.fn(), readImage: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/payments", () => ({ getReceiptForParty: mocks.getReceiptForParty }));
vi.mock("@/lib/blob-store", () => ({ readImage: mocks.readImage }));

const call = () =>
  GET(new Request("http://localhost/trips/trip-1/costs/payments/p1/receipt"), {
    params: Promise.resolve({ tripId: "trip-1", paymentId: "p1" }),
  });

const imageOf = (bytes: number[]) => ({
  statusCode: 200,
  stream: new Response(new Uint8Array(bytes)).body!,
  blob: { contentType: "image/jpeg" },
});

describe("GET payment receipt", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben", image: null });
  });

  it("gives the payer or receiver the image with private, no-store and nosniff headers", async () => {
    mocks.getReceiptForParty.mockResolvedValue("receipts/r.jpg");
    mocks.readImage.mockResolvedValue(imageOf([0xff, 0xd8, 0xff, 2]));
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("Location")).toBeNull();
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 2]);
    expect(mocks.getReceiptForParty).toHaveBeenCalledWith("trip-1", "p1", "u1");
    expect(mocks.readImage).toHaveBeenCalledWith("receipts/r.jpg");
  });

  it("gives a third member, a stranger or a party who left the same 404, and never reads the file", async () => {
    mocks.getReceiptForParty.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(response.headers.get("Content-Type")).not.toContain("image");
    expect(mocks.readImage).not.toHaveBeenCalled();
  });

  it("gives the same 404 when the file is missing from the store", async () => {
    mocks.getReceiptForParty.mockResolvedValue("receipts/gone.jpg");
    mocks.readImage.mockResolvedValue(null);
    const missing = await call();
    mocks.getReceiptForParty.mockResolvedValue(null);
    const refused = await call();
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe(await refused.text());
    expect([...missing.headers].sort()).toEqual([...refused.headers].sort());
  });
});
