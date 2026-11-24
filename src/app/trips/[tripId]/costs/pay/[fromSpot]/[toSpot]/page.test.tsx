import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PayPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getPayPageForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/payments", () => ({ getPayPageForMember: mocks.getPayPageForMember }));
vi.mock("@/app/trips/[tripId]/costs/payments/actions", () => ({ recordPaymentAction: async () => ({}) }));

type ContentProps = { params: Promise<{ tripId: string; fromSpot: string; toSpot: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function render() {
  const page = PayPage({
    params: Promise.resolve({ tripId: "trip-1", fromSpot: "ben", toSpot: "ana" }),
  } as Parameters<typeof PayPage>[0]) as ReactElement<{ children: ReactElement<ContentProps> }>;
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

const account = (extra = {}) => ({
  id: "acc-1",
  kind: "gcash",
  bankName: null,
  accountName: "Ana Reyes",
  number: "09187654321",
  hasQr: true,
  ...extra,
});

// Ben pays Ana 1,200.00, seen by Ben.
const payerView = {
  currency: "PHP",
  from: person("ben", "Ben", { isYou: true }),
  to: person("ana", "Ana"),
  amount: 120000,
  canRecord: true,
  receiver: { accounts: [account(), account({ id: "acc-2", kind: "bank", bankName: "BDO", number: "001234567890", hasQr: false })] },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Ben Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue({ id: "trip-1", currency: "PHP", timeZone: "Asia/Manila" });
  mocks.getPayPageForMember.mockResolvedValue(payerView);
});

describe("the Pay page", () => {
  it("shows not found for a stranger or a spot that is not in the trip", async () => {
    mocks.getPayPageForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    mocks.getPayPageForMember.mockResolvedValue(payerView);
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.getPayPageForMember).toHaveBeenCalledWith("trip-1", "ben", "ana", "u1");
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getPayPageForMember).not.toHaveBeenCalled();
  });

  it("shows the payer the amount, the receiver's details, QR and Copy, and the Mark it paid form", async () => {
    const html = await render();
    expect(html).toContain('href="/trips/trip-1/costs/balances"');
    expect(html).toContain(">Pay Ana</h1>");
    expect(html).toContain("You pay Ana");
    expect(html).toContain("₱1,200.00");
    expect(html).toContain("Ana&#x27;s details");
    expect(html).toContain("GCash");
    expect(html).toContain("0918 765 4321");
    expect(html).toContain("BDO");
    expect(html).toContain("0012 3456 7890");
    expect(html).toContain('src="/profile/payment-details/acc-1/qr"');
    expect(html).toContain('alt="GCash QR code for Ana Reyes"');
    expect(html).not.toContain("/profile/payment-details/acc-2/qr");
    expect(html).toContain('aria-label="Copy GCash number"');
    expect(html).toContain("Mark it paid");
    expect(html).toContain('name="paymentId"');
    expect(html).toContain('value="1200.00"');
  });

  it("never prints an email or a stored file name", async () => {
    const html = await render();
    expect(html).not.toContain("@");
    expect(html).not.toContain("qr/");
  });

  it("gives the receiver a green amount, what the payer sees, and Got the money?", async () => {
    mocks.getPayPageForMember.mockResolvedValue({
      ...payerView,
      from: person("bea", "Bea"),
      to: person("ben", "Ben", { isYou: true }),
      amount: 45000,
      receiver: { accounts: [account(), account({ id: "acc-2", kind: "bank", bankName: "BPI", hasQr: false })] },
    });
    const html = await render();
    expect(html).toContain(">Bea pays you</h1>");
    expect(html).toContain("text-owed");
    expect(html).toContain("Bea sees your details here: GCash and BPI.");
    expect(html).toContain("Change them on Profile");
    expect(html).toContain("Got the money?");
    expect(html).toContain("How did Bea pay?");
    expect(html).not.toContain("&#x27;s details</h2>");
    expect(html).not.toContain("Copy GCash number");
  });

  it("tells a receiver with no saved details to add them", async () => {
    mocks.getPayPageForMember.mockResolvedValue({
      ...payerView,
      from: person("bea", "Bea"),
      to: person("ben", "Ben", { isYou: true }),
      receiver: { reason: "none" },
    });
    const html = await render();
    expect(html).toContain("You haven&#x27;t added payment details yet");
    expect(html).toContain("Add them on Profile");
  });

  it("shows a third person the line and the details but no Mark it paid", async () => {
    mocks.getPayPageForMember.mockResolvedValue({
      ...payerView,
      from: person("bea", "Bea"),
      canRecord: false,
    });
    const html = await render();
    expect(html).toContain(">Bea pays Ana</h1>");
    expect(html).toContain("Ana&#x27;s details");
    expect(html).not.toContain("Mark it paid");
    expect(html).not.toContain('name="paymentId"');
  });

  it("explains why there are no details", async () => {
    mocks.getPayPageForMember.mockResolvedValue({ ...payerView, receiver: { reason: "none" } });
    expect(await render()).toContain("Ana hasn&#x27;t added payment details yet. Ask them in the group chat.");
    mocks.getPayPageForMember.mockResolvedValue({ ...payerView, to: person("ana", "Dana", { isGuest: true }), receiver: { reason: "guest" } });
    expect(await render()).toContain("Dana is a guest, so there are no saved details.");
    mocks.getPayPageForMember.mockResolvedValue({ ...payerView, to: person("ana", "Ana", { hasLeft: true }), receiver: { reason: "left" } });
    expect(await render()).toContain("Ana left the trip, so their details are hidden.");
  });

  it("says so when the line is gone, and shows no details or form", async () => {
    mocks.getPayPageForMember.mockResolvedValue({ ...payerView, amount: 0 });
    const html = await render();
    expect(html).toContain("Nothing to pay here anymore.");
    expect(html).toContain("Balances changed.");
    expect(html).toContain('href="/trips/trip-1/costs/balances"');
    expect(html).not.toContain("Mark it paid");
    expect(html).not.toContain("0918 765 4321");
  });
});
