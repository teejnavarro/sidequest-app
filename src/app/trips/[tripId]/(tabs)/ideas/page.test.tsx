import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdeasPage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listIdeasForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/ideas", () => ({ listIdeasForMember: mocks.listIdeasForMember }));

type ContentProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The page keeps its work in a component inside Suspense, so run that component directly.
async function render(search: Record<string, string | string[] | undefined> = {}) {
  const page = IdeasPage({
    params: Promise.resolve({ tripId: "trip-1" }),
    searchParams: Promise.resolve(search),
  } as Parameters<typeof IdeasPage>[0]) as ReactElement<{ children: ReactElement<ContentProps> }>;
  const content = page.props.children;
  const run = content.type as (props: ContentProps) => Promise<ReactElement>;
  return renderToStaticMarkup(await run(content.props));
}

const trip = { id: "trip-1", ownerId: "owner" };
const person = (id: string, name: string) => ({ id, name, image: null });

const idea = (id: string, name: string, type: string, addedBy = person("u1", "Maya Cruz"), extra = {}) => ({
  id,
  name,
  type,
  duration: "short",
  link: null,
  area: null,
  costPerPerson: null,
  costCurrency: null,
  notes: null,
  createdAt: new Date("2027-01-01T00:00:00Z"),
  addedBy,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.listIdeasForMember.mockResolvedValue([]);
});

describe("the Ideas tab", () => {
  it("shows not found to someone who is not in the trip, and reads no ideas", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(render()).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.listIdeasForMember).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(render()).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("shows the empty state with one Add an idea button", async () => {
    const html = await render();
    expect(html).toContain("No ideas yet");
    expect(html).toContain("we should totally go here");
    expect(html).toContain("Start with one place you&#x27;d love to go.");
    expect(html.match(/Add an idea/g)).toHaveLength(1);
    expect(html).toContain('href="/trips/trip-1/ideas/new"');
    expect(html).not.toContain("Filter by type");
  });

  it("lists ideas in the order the privacy layer gives them (newest first)", async () => {
    mocks.listIdeasForMember.mockResolvedValue([
      idea("3", "Newest idea", "food"),
      idea("2", "Middle idea", "food"),
      idea("1", "Oldest idea", "food"),
    ]);
    const html = await render();
    expect(html.indexOf("Newest idea")).toBeLessThan(html.indexOf("Middle idea"));
    expect(html.indexOf("Middle idea")).toBeLessThan(html.indexOf("Oldest idea"));
    expect(html.match(/Add an idea/g)).toHaveLength(1);
  });

  it("shows names with accents exactly", async () => {
    mocks.listIdeasForMember.mockResolvedValue([idea("1", "Chợ Bến Thành", "sightseeing")]);
    expect(await render()).toContain("Chợ Bến Thành");
  });

  describe("filter chips", () => {
    const some = [
      idea("1", "A", "food"),
      idea("2", "B", "food"),
      idea("3", "C", "nightlife"),
    ];

    it("shows All with the total and only the types in use, with counts", async () => {
      mocks.listIdeasForMember.mockResolvedValue(some);
      const nav = (await render()).match(/<nav[^>]*>[^]*?<\/nav>/)?.[0] ?? "";
      expect(nav).toMatch(/All\s*<span[^>]*>3<\/span>/);
      expect(nav).toMatch(/Food\s*<span[^>]*>2<\/span>/);
      expect(nav).toMatch(/Nightlife\s*<span[^>]*>1<\/span>/);
      expect(nav).not.toContain("Sightseeing");
      expect(nav).not.toContain("Adventure");
      expect(nav).toContain('href="/trips/trip-1/ideas?type=food"');
      expect(nav).toContain('href="/trips/trip-1/ideas"');
    });

    it("filters by the type in the address and marks that chip", async () => {
      mocks.listIdeasForMember.mockResolvedValue(some);
      const html = await render({ type: "nightlife" });
      expect(html).toContain(">C<");
      expect(html).not.toContain(">A<");
      expect(html).not.toContain(">B<");
      const marked = html.match(/<a[^>]*aria-current="page"[^>]*>[^]*?<\/a>/g) ?? [];
      expect(marked).toHaveLength(1);
      expect(marked[0]).toContain("Nightlife");
    });

    it.each([
      ["an unknown type", "mystery"],
      ["a real type with no ideas", "adventure"],
      ["an empty type", ""],
      ["more than one type", ["food", "nightlife"]],
    ])("falls back to All for %s", async (_label, type) => {
      mocks.listIdeasForMember.mockResolvedValue(some);
      const html = await render({ type });
      for (const name of [">A<", ">B<", ">C<"]) expect(html).toContain(name);
      const marked = html.match(/<a[^>]*aria-current="page"[^>]*>[^]*?<\/a>/g) ?? [];
      expect(marked).toHaveLength(1);
      expect(marked[0]).toContain("All");
    });
  });

  describe("Edit idea", () => {
    const mine = idea("1", "Mine", "food", person("u1", "Maya Cruz"));
    const theirs = idea("2", "Theirs", "food", person("u2", "Ben Reyes"));

    it("is shown for the person's own ideas only", async () => {
      mocks.listIdeasForMember.mockResolvedValue([mine, theirs]);
      const html = await render();
      expect(html).toContain('href="/trips/trip-1/ideas/1/edit"');
      expect(html).not.toContain('href="/trips/trip-1/ideas/2/edit"');
    });

    it("is shown for every idea to the trip owner", async () => {
      mocks.getCurrentUser.mockResolvedValue({ id: "owner", name: "Owner", image: null });
      mocks.listIdeasForMember.mockResolvedValue([mine, theirs]);
      const html = await render();
      expect(html).toContain('href="/trips/trip-1/ideas/1/edit"');
      expect(html).toContain('href="/trips/trip-1/ideas/2/edit"');
    });

    it("is not shown to another member who added neither", async () => {
      mocks.getCurrentUser.mockResolvedValue({ id: "u3", name: "Third", image: null });
      mocks.listIdeasForMember.mockResolvedValue([mine, theirs]);
      expect(await render()).not.toContain("Edit idea");
    });
  });

  it("shows who added each idea", async () => {
    mocks.listIdeasForMember.mockResolvedValue([idea("2", "Theirs", "food", person("u2", "Ben Reyes"))]);
    expect(await render()).toContain("Added by Ben");
  });

  it("opens the link in a new tab safely, with the Google Maps label for a Maps link", async () => {
    mocks.listIdeasForMember.mockResolvedValue([
      idea("1", "Maps one", "food", person("u1", "Maya"), { link: "https://maps.app.goo.gl/abc" }),
      idea("2", "Plain one", "food", person("u1", "Maya"), { link: "https://example.com/place" }),
    ]);
    const html = await render();
    expect(html).toContain('href="https://maps.app.goo.gl/abc"');
    expect(html).toContain("Open in Google Maps");
    expect(html).toContain("Open link");
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });
});
