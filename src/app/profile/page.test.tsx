import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./page";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/app/actions", () => ({ signOut: vi.fn() }));
vi.mock("./name-form", () => ({ NameForm: () => null }));
vi.mock("./payment-details-card", () => ({ PaymentDetailsCard: () => null }));

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = ProfilePage() as ReactElement<{ children: ReactElement[] }>;
  const main = page.props.children[1] as ReactElement<{ children: ReactElement<{ children: ReactElement }> }>;
  const content = main.props.children.props.children;
  return renderToStaticMarkup(await (content.type as () => Promise<ReactElement>)());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
});

describe("ProfilePage", () => {
  it("links the privacy note and Delete my account under Sign out", async () => {
    const html = await renderContent();
    const signOut = html.indexOf("Sign out");
    const privacy = html.indexOf('href="/privacy"');
    const del = html.indexOf('href="/profile/delete"');
    expect(signOut).toBeGreaterThan(-1);
    expect(privacy).toBeGreaterThan(signOut);
    expect(del).toBeGreaterThan(privacy);
    expect(html).toContain("Privacy note");
    expect(html).toContain("Delete my account");
  });

  it("shows nothing to a signed-out visitor", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
  });
});
