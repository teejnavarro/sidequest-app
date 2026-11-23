import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), listCostsForExport: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/costs", () => ({ listCostsForExport: mocks.listCostsForExport }));

const call = () =>
  GET(new Request("http://localhost/trips/trip-1/costs/export"), { params: Promise.resolve({ tripId: "trip-1" }) });

describe("GET costs export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maria Cruz", image: null });
  });

  it("gives a stranger a 404 and no file", async () => {
    mocks.listCostsForExport.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).not.toContain("text/csv");
    expect(mocks.listCostsForExport).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("gives a member the CSV with private headers and both filename forms", async () => {
    mocks.listCostsForExport.mockResolvedValue({
      tripName: "Bún Chả trip",
      currency: "PHP",
      people: [{ spotId: "a", name: "Maria Cruz", isGuest: false, hasLeft: false }],
      costs: [],
    });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      "attachment; filename=\"bun-cha-trip-costs.csv\"; filename*=UTF-8''bun-cha-trip-costs.csv",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // Response.text() drops the BOM, so check the raw bytes: EF BB BF then "Date".
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toContain("﻿Date,What");
  });
});
