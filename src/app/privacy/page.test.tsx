import { Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "./page";

const mocks = vi.hoisted(() => ({ getOptionalUser: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getOptionalUser: mocks.getOptionalUser }));

type Kids = { children: ReactElement[] };

// The back link reads the session, so it sits inside Suspense: run it directly.
async function renderBand() {
  const suspense = (PrivacyPage() as ReactElement<Kids>).props.children.find((child) => child.type === Suspense)!;
  const band = (suspense.props as { children: ReactElement }).children;
  return renderToStaticMarkup(await (band.type as () => Promise<ReactElement>)());
}

// What shows before the session is read, and for every visitor.
function renderStatic() {
  const kids = (PrivacyPage() as ReactElement<Kids>).props.children;
  const suspense = kids.find((child) => child.type === Suspense)!;
  const fallback = (suspense.props as { fallback: ReactElement }).fallback;
  return renderToStaticMarkup(<>{[fallback, ...kids.filter((child) => child !== suspense)]}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOptionalUser.mockResolvedValue(null);
});

describe("PrivacyPage", () => {
  it("goes back to Profile when signed in", async () => {
    mocks.getOptionalUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
    const html = await renderBand();
    expect(html).toContain('href="/profile"');
    expect(html).toContain("Profile");
    expect(html).not.toContain('href="/"');
  });

  it("goes back to the sign-in page when signed out", async () => {
    const html = await renderBand();
    expect(html).toContain('href="/"');
    expect(html).toContain("Sidequest");
    expect(html).not.toContain('href="/profile"');
  });

  it("shows the approved note to everyone without reading the session", () => {
    const html = renderStatic();
    expect(mocks.getOptionalUser).not.toHaveBeenCalled();
    for (const title of ["What Sidequest keeps", "Who sees it", "Where it lives", "Deleting your account"]) {
      expect(html).toContain(`>${title}</h2>`);
    }
    expect(html).toContain("Your email: nobody.");
    expect(html).toContain('href="https://github.com/teejnavarro/sidequest-app"');
    expect(html).toContain(
      "A receipt photo on a cost: everyone in the trip right now. It stays with the trip if the person who added it deletes their account.",
    );
    expect(html).toContain("Updated 27 November 2026.");
    // The fallback is the signed-out band, so the header is never empty.
    expect(html).toContain('href="/"');
  });
});
