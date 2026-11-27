import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getCostPhotoForMember: vi.fn(), readImage: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/costs", () => ({ getCostPhotoForMember: mocks.getCostPhotoForMember }));
vi.mock("@/lib/blob-store", () => ({ readImage: mocks.readImage }));

const call = () =>
  GET(new Request("http://localhost/trips/trip-1/costs/c1/photo"), {
    params: Promise.resolve({ tripId: "trip-1", costId: "c1" }),
  });

const imageOf = (bytes: number[]) => ({
  statusCode: 200,
  stream: new Response(new Uint8Array(bytes)).body!,
  blob: { contentType: "image/jpeg" },
});

describe("GET cost photo", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben", image: null });
  });

  it("gives a current member the image with private, no-store and nosniff headers", async () => {
    mocks.getCostPhotoForMember.mockResolvedValue("cost-photos/p.jpg");
    mocks.readImage.mockResolvedValue(imageOf([0xff, 0xd8, 0xff, 2]));
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe("inline");
    expect(response.headers.get("Location")).toBeNull();
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 2]);
    expect(mocks.getCostPhotoForMember).toHaveBeenCalledWith("trip-1", "c1", "u1");
    expect(mocks.readImage).toHaveBeenCalledWith("cost-photos/p.jpg");
  });

  it("gives no photo, a stranger, a person who left, a trashed cost or an unknown cost the same 404, never reading the file", async () => {
    mocks.getCostPhotoForMember.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Type")).not.toContain("image");
    expect(mocks.readImage).not.toHaveBeenCalled();
  });

  it("gives the same 404 when the file is missing from the store", async () => {
    mocks.getCostPhotoForMember.mockResolvedValue("cost-photos/gone.jpg");
    mocks.readImage.mockResolvedValue(null);
    const missing = await call();
    mocks.getCostPhotoForMember.mockResolvedValue(null);
    const refused = await call();
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe(await refused.text());
    expect([...missing.headers].sort()).toEqual([...refused.headers].sort());
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(call()).rejects.toThrow("redirect:/");
    expect(mocks.getCostPhotoForMember).not.toHaveBeenCalled();
  });
});
