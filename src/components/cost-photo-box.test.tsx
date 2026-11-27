import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CostPhotoBox } from "./cost-photo-box";

// A static render can't run the server action, so a test that needs the state the server sends
// back sets `serverState`; every other test gets React's own hook.
const fake = vi.hoisted(() => ({ serverState: null as unknown }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: ((action: never, initial: never) =>
      fake.serverState ? [fake.serverState, () => {}, false] : actual.useActionState(action, initial)) as typeof actual.useActionState,
  };
});
vi.mock("@/app/trips/[tripId]/costs/actions", () => ({ addCostPhotoAction: async () => ({}) }));

const box = (photoSrc: string | null = null) =>
  renderToStaticMarkup(<CostPhotoBox tripId="trip-1" costId="c1" photoSrc={photoSrc} />);

describe("CostPhotoBox", () => {
  it("is an Add photo box with a hidden image picker that posts the ids", () => {
    const html = box();
    expect(html).toContain("Add photo");
    expect(html).toContain("border-dashed");
    expect(html).toMatch(/<input type="file" accept="image\/\*"[^>]*name="photo"/);
    expect(html).toContain('name="tripId" value="trip-1"');
    expect(html).toContain('name="costId" value="c1"');
    expect(html).not.toContain("<a ");
  });

  it("is a thumbnail link that opens the photo in a new tab when there is one", () => {
    const html = box("/trips/trip-1/costs/c1/photo");
    expect(html).toContain('href="/trips/trip-1/costs/c1/photo"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('alt="Receipt photo"');
    expect(html).not.toContain("Add photo");
    expect(html).not.toContain('type="file"');
  });

  it("shows the server's error in the error color under the hero", () => {
    const message = "Couldn't add the photo. Try again with a smaller picture or better signal.";
    fake.serverState = { error: message };
    try {
      const html = box().replaceAll("&#x27;", "'");
      expect(html).toContain(message);
      expect(html).toContain("text-owe");
      expect(html).toContain("Add photo");
    } finally {
      fake.serverState = null;
    }
  });
});
