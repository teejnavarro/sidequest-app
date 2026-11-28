import { Suspense, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { StoryMotion } from "@/components/home/story-motion";

const mocks = vi.hoisted(() => ({ getOptionalUserForPage: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getOptionalUserForPage: mocks.getOptionalUserForPage }));
vi.mock("@/app/actions", () => ({ signInWithGoogle: vi.fn() }));
// The real image component needs the sizes Next.js reads from the picture files; a plain img is
// enough to check the alt texts.
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} src="/shot.png" />,
}));

type Params = Record<string, string | string[] | undefined>;
type AsyncPart = (props: { searchParams: Promise<Params> }) => Promise<ReactElement>;

function page(params: Params = {}) {
  return Home({ searchParams: Promise.resolve(params) }) as ReactElement;
}

// Every Suspense in the page, wherever it sits (some are inside a Ticket's `main` prop).
function suspensesIn(node: ReactNode, found: ReactElement<{ children: ReactElement }>[] = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => suspensesIn(child, found));
  } else if (isValidElement<Record<string, ReactNode>>(node)) {
    if (node.type === Suspense) found.push(node as ReactElement<{ children: ReactElement }>);
    Object.entries(node.props).forEach(([name, value]) => {
      if (name !== "fallback") suspensesIn(value, found);
    });
  }
  return found;
}

// The parts that read the session sit inside Suspense: run one directly, found by its name.
async function renderPart(name: "TopAction" | "HeroAction" | "LastStopAction", params: Params = {}) {
  const part = suspensesIn(page(params))
    .map((suspense) => suspense.props.children)
    .find((child) => (child.type as AsyncPart).name === name)!;
  const run = part.type as AsyncPart;
  return renderToStaticMarkup(await run(part.props as { searchParams: Promise<Params> }));
}

// The rest of the page renders at once for everyone; the session parts show their fallbacks.
function renderStatic() {
  return renderToStaticMarkup(page());
}

const signedIn = { id: "u1", name: "Maya", image: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOptionalUserForPage.mockResolvedValue(null);
});

describe("hero", () => {
  it("says the account is deleted after a deletion", async () => {
    const html = await renderPart("HeroAction", { deleted: "1" });
    expect(html).toContain("Your account is deleted.");
    expect(html).toContain("Continue with Google");
  });

  it("says nothing about deletion on a normal visit or another value", async () => {
    expect(await renderPart("HeroAction")).not.toContain("Your account is deleted.");
    expect(await renderPart("HeroAction", { deleted: "yes" })).not.toContain("Your account is deleted.");
  });

  it("sends a signed-in person to My trips instead", async () => {
    mocks.getOptionalUserForPage.mockResolvedValue(signedIn);
    const html = await renderPart("HeroAction", { deleted: "1" });
    expect(html).toContain('href="/trips"');
    expect(html).toContain("Go to My trips");
    expect(html).not.toContain("Your account is deleted.");
    expect(html).not.toContain("Continue with Google");
  });
});

describe("last stop", () => {
  it("offers Google when signed out", async () => {
    const html = await renderPart("LastStopAction");
    expect(html).toContain("Got a trip coming up?");
    expect(html).toContain("Continue with Google");
    expect(html).not.toContain('href="/trips"');
  });

  it("offers My trips when signed in", async () => {
    mocks.getOptionalUserForPage.mockResolvedValue(signedIn);
    const html = await renderPart("LastStopAction");
    expect(html).toContain("Back to planning?");
    expect(html).toContain('href="/trips"');
    expect(html).not.toContain("Continue with Google");
  });
});

describe("top action", () => {
  it("shows nothing when signed out", async () => {
    expect(await renderPart("TopAction")).toBe("");
  });

  it("shows a My trips link when signed in", async () => {
    mocks.getOptionalUserForPage.mockResolvedValue(signedIn);
    const html = await renderPart("TopAction");
    expect(html).toContain('href="/trips"');
    expect(html).toContain("My trips");
  });
});

describe("static page", () => {
  it("always links the privacy note and the code", () => {
    const html = renderStatic();
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy note");
    expect(html).toContain('href="https://github.com/teejnavarro/sidequest-app"');
  });

  it("has one h1 and the six step headlines", () => {
    const html = renderStatic();
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("Your trip, out of the group chat.");
    for (const headline of [
      "Start a trip in a minute.",
      "One link for the group chat.",
      "Every &quot;we should totally go here&quot; in one place.",
      "One card per day, so nobody has to ask what time.",
      "Who paid, who owes, and no awkward chats about it.",
      "Settle up with GCash, Maya or bank.",
    ]) {
      expect(html).toContain(headline);
    }
  });

  it("gives every screenshot a description", () => {
    const images = renderStatic().match(/<img[^>]*>/g) ?? [];
    expect(images).toHaveLength(6);
    for (const image of images) expect(image).toMatch(/alt="[^"]+"/);
  });
});

describe("story motion", () => {
  it("renders nothing and sits on the page once", () => {
    expect(renderToStaticMarkup(<StoryMotion />)).toBe("");
    const hasMotion = (node: ReactNode): boolean =>
      Array.isArray(node)
        ? node.some(hasMotion)
        : isValidElement<Record<string, ReactNode>>(node) &&
          (node.type === StoryMotion || Object.values(node.props).some(hasMotion));
    expect(hasMotion(page())).toBe(true);
  });
});
