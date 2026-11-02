import { beforeEach, describe, expect, it, vi } from "vitest";
import EditTripPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/components/trip-form", () => ({ TripForm: () => null }));

const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof EditTripPage>[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
});

// The layout's check does not protect this page, so the page must check for itself.
describe("EditTripPage", () => {
  it("shows not found to someone who is not a member", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(EditTripPage(props)).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("sends a signed-out visitor away before looking up the trip", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(EditTripPage(props)).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("gives a member the form with the trip's current details", async () => {
    mocks.getTripForMember.mockResolvedValue({
      id: "trip-1",
      name: "Hội An long weekend",
      startDate: "2027-03-12",
      endDate: "2027-03-15",
      timeZone: "Asia/Ho_Chi_Minh",
      currency: "VND",
      ownerId: "u1",
      ownerName: "Maya",
      ownerImage: null,
    });
    const page = await EditTripPage(props);
    expect(JSON.stringify(page)).toContain("Hội An long weekend");
  });
});
