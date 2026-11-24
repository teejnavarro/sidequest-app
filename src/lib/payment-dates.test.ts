import { describe, expect, it } from "vitest";
import { paymentDayLabel, paymentTimeLabel } from "./payment-dates";

describe("payment dates", () => {
  const at = new Date("2026-11-24T06:05:00Z"); // 14:05 in Manila, 13:05 in Saigon

  it("uses the trip time zone for the day", () => {
    expect(paymentDayLabel(at, "Asia/Manila")).toBe("Tue, Nov 24");
    expect(paymentDayLabel(new Date("2026-11-23T20:00:00Z"), "Asia/Manila")).toBe("Tue, Nov 24");
    expect(paymentDayLabel(new Date("2026-11-23T20:00:00Z"), "UTC")).toBe("Mon, Nov 23");
  });

  it("adds the 24-hour time", () => {
    expect(paymentTimeLabel(at, "Asia/Manila")).toBe("Tue, Nov 24, 14:05");
    expect(paymentTimeLabel(at, "Asia/Ho_Chi_Minh")).toBe("Tue, Nov 24, 13:05");
  });
});
