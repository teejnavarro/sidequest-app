import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentPage from "./page";
import DeletePaymentPage from "./delete/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getPaymentForParty: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/payments", () => ({ getPaymentForParty: mocks.getPaymentForParty }));
vi.mock("./actions", () => ({ deletePaymentAction: async () => ({}) }));
vi.mock("../actions", () => ({ deletePaymentAction: async () => ({}) }));

type ContentProps = { params: Promise<{ tripId: string; paymentId: string }> };

async function renderPage(Page: (p: never) => ReactElement) {
  const page = (Page as unknown as (p: unknown) => ReactElement<{ children: ReactElement<ContentProps> }>)({
    params: Promise.resolve({ tripId: "trip-1", paymentId: "p1" }),
  });
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(content.props));
}

const person = (spotId: string, name: string, extra = {}) => ({
  spotId,
  name,
  isGuest: false,
  hasLeft: false,
  isYou: false,
  ...extra,
});

const payment = {
  id: "p1",
  from: person("ben", "Ben", { isYou: true }),
  to: person("ana", "Ana"),
  amount: 30000,
  currency: "PHP",
  method: "gcash",
  createdAt: new Date("2026-11-24T06:05:00Z"),
  mine: true,
  hasReceipt: true,
  recordedBy: "Ben",
  recordedByYou: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP", timeZone: "Asia/Manila" });
  mocks.getPaymentForParty.mockResolvedValue(payment);
});

describe.each([
  ["Payment", PaymentPage],
  ["Delete payment", DeletePaymentPage],
] as const)("%s page", (_name, Page) => {
  it("shows not found to anyone who is not the payer or the receiver, or not in the trip", async () => {
    mocks.getPaymentForParty.mockResolvedValue(null);
    await expect(renderPage(Page)).rejects.toThrow("not-found");
    mocks.getPaymentForParty.mockResolvedValue(payment);
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(renderPage(Page)).rejects.toThrow("not-found");
    expect(mocks.getPaymentForParty).toHaveBeenCalledWith("trip-1", "p1", "u1");
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderPage(Page)).rejects.toThrow("redirect:/");
    expect(mocks.getPaymentForParty).not.toHaveBeenCalled();
  });
});

describe("the Payment page", () => {
  it("shows the sentence, the time in the trip time zone, who recorded it and the receipt", async () => {
    const html = await renderPage(PaymentPage);
    expect(html).toContain(">Payment</h1>");
    expect(html).toContain("You paid Ana ₱300.00 via GCash.");
    expect(html).toContain("Tue, Nov 24, 14:05 · Recorded by you");
    expect(html).toContain('src="/trips/trip-1/costs/payments/p1/receipt"');
    expect(html).toContain("Only you and Ana can see this receipt.");
    expect(html).toContain('href="/trips/trip-1/costs/payments/p1/delete"');
    expect(html).toContain("Delete payment");
    expect(html).not.toContain("receipts/");
  });

  it("names the recorder when someone else did, and hides the receipt block when there is none", async () => {
    mocks.getPaymentForParty.mockResolvedValue({
      ...payment,
      from: person("bea", "Bea"),
      to: person("ben", "Ben", { isYou: true }),
      hasReceipt: false,
      recordedBy: "Bea",
      recordedByYou: false,
      method: "cash",
    });
    const html = await renderPage(PaymentPage);
    expect(html).toContain("Bea paid you ₱300.00 in cash.");
    expect(html).toContain("Recorded by Bea");
    expect(html).not.toContain("/receipt");
  });
});

describe("the Delete payment page", () => {
  it("asks first, names the payment, says what happens, and has Keep payment and a red delete", async () => {
    const html = await renderPage(DeletePaymentPage);
    expect(html).toContain(">Delete payment?</h1>");
    expect(html).toContain("Delete “You paid Ana ₱300.00 via GCash”?");
    expect(html).toContain("Balances go back to before it, for everyone.");
    expect(html).toContain("The receipt is deleted too.");
    expect(html).toContain("You can&#x27;t undo this.");
    expect(html).toMatch(/<a[^>]*href="\/trips\/trip-1\/costs\/payments\/p1"[^>]*>Keep payment<\/a>/);
    expect(html).toContain('name="paymentId" value="p1"');
    expect(html).toContain("text-owe");
  });

  it("leaves out the receipt line when there is no receipt", async () => {
    mocks.getPaymentForParty.mockResolvedValue({ ...payment, hasReceipt: false });
    expect(await renderPage(DeletePaymentPage)).not.toContain("The receipt is deleted too.");
  });
});
