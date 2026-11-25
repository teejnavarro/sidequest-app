import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteAccountPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getAccountDeletionCheck: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/account", () => ({ getAccountDeletionCheck: mocks.getAccountDeletionCheck }));
vi.mock("./actions", () => ({ deleteAccountAction: vi.fn() }));
vi.mock("@/components/confirm-form", () => ({
  ConfirmForm: ({ label }: { label: string }) => <button>{label}</button>,
}));

const empty = { handOver: [], soloTrips: [], owing: [] };

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = DeleteAccountPage() as ReactElement<{ children: ReactElement[] }>;
  const main = page.props.children[1] as ReactElement<{ children: ReactElement<{ children: ReactElement }> }>;
  const content = main.props.children.props.children;
  const render = content.type as () => Promise<ReactElement>;
  return renderToStaticMarkup(await render());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.getAccountDeletionCheck.mockResolvedValue(empty);
});

// The layout's check does not protect this page, so the page must check for itself.
describe("DeleteAccountPage", () => {
  it("sends a signed-out visitor away before reading anything", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getAccountDeletionCheck).not.toHaveBeenCalled();
  });

  it("asks for this person's check, and nobody else's", async () => {
    await renderContent();
    expect(mocks.getAccountDeletionCheck).toHaveBeenCalledWith("u1");
  });

  it("State A: lists trips to hand over and has no delete button", async () => {
    mocks.getAccountDeletionCheck.mockResolvedValue({
      ...empty,
      handOver: [{ tripId: "t1", name: "Saigon barkada", peopleCount: 3 }],
    });
    const html = await renderContent();
    expect(html).toContain("First, hand over your trips");
    expect(html).toContain("Saigon barkada");
    expect(html).toContain("You + 2 · Make someone else the owner");
    expect(html).toContain('href="/trips/t1/invite"');
    expect(html).toContain("Delete my account opens once no trip is left here.");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Keep my account");
  });

  it("State B: names solo trips with their cost counts and the amounts still owed", async () => {
    mocks.getAccountDeletionCheck.mockResolvedValue({
      handOver: [],
      soloTrips: [
        { tripId: "t2", name: "Tokyo test", costCount: 2 },
        { tripId: "t3", name: "Empty trip", costCount: 0 },
        { tripId: "t4", name: "One cost trip", costCount: 1 },
      ],
      owing: [{ tripId: "t5", name: "Baguio weekend", amount: 85000, currency: "PHP" }],
    });
    const html = await renderContent();
    expect(html).toContain("Delete your account?");
    expect(html).toContain("<b>Tokyo test</b>, since only you are in it (2 costs)");
    expect(html).toContain("<b>Empty trip</b>, since only you are in it</span>");
    expect(html).toContain("(1 cost)");
    expect(html).toContain("You still owe ₱850.00 in Baguio weekend. That stays on the trip&#x27;s balances.");
    expect(html).toContain("stay in your trips under &quot;Former member&quot;");
    expect(html).toContain("Keep my account");
    expect(html).toContain('href="/profile"');
    expect(html).toContain("Delete my account");
    expect(html).not.toContain("hand over your trips");
  });

  it("State B with nothing special shows only the standard lines", async () => {
    const html = await renderContent();
    expect(html).toContain("Receipts you uploaded");
    expect(html).not.toContain("since only you are in it");
    expect(html).not.toContain("You still owe");
  });
});
