import { Suspense, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mocks = vi.hoisted(() => ({ getOptionalUser: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getOptionalUser: mocks.getOptionalUser }));
vi.mock("@/app/actions", () => ({ signInWithGoogle: vi.fn() }));

type Params = Record<string, string | string[] | undefined>;
type Kids = { children: ReactElement[] };

function page(params: Params) {
  return Home({ searchParams: Promise.resolve(params) }) as ReactElement<Kids>;
}

// The sign-in area reads the session and the address, so it sits inside Suspense: run it directly.
async function renderSignIn(params: Params) {
  const suspense = page(params).props.children.find((child) => child.type === Suspense)!;
  const area = (suspense.props as { children: ReactElement<{ searchParams: Promise<Params> }> }).children;
  const run = area.type as (props: typeof area.props) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(area.props));
}

// Everything outside Suspense renders at once, for everyone.
function renderStatic() {
  return renderToStaticMarkup(<>{page({}).props.children.filter((child) => child.type !== Suspense)}</>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOptionalUser.mockResolvedValue(null);
});

describe("sign-in page", () => {
  it("says the account is deleted after a deletion", async () => {
    const html = await renderSignIn({ deleted: "1" });
    expect(html).toContain("Your account is deleted.");
    expect(html).toContain("Continue with Google");
  });

  it("says nothing about deletion on a normal visit or another value", async () => {
    expect(await renderSignIn({})).not.toContain("Your account is deleted.");
    expect(await renderSignIn({ deleted: "yes" })).not.toContain("Your account is deleted.");
  });

  it("sends a signed-in person to My trips instead", async () => {
    mocks.getOptionalUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
    const html = await renderSignIn({ deleted: "1" });
    expect(html).toContain('href="/trips"');
    expect(html).not.toContain("Your account is deleted.");
  });

  it("always links the privacy note, signed in or not", () => {
    const html = renderStatic();
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy note");
  });
});
