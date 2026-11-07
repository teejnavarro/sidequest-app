import { existsSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddIdeaPage from "./new/page";
import EditIdeaPage from "./[ideaId]/edit/page";
import DeleteIdeaPage from "./[ideaId]/delete/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getIdeaForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/ideas", () => ({ getIdeaForMember: mocks.getIdeaForMember }));
// Show the form's props as text, so the pages' choices (which values, which currency) can be read.
vi.mock("@/components/idea-form", () => ({
  IdeaForm: (props: Record<string, unknown>) => <pre data-form>{JSON.stringify(props)}</pre>,
}));
vi.mock("./[ideaId]/delete/delete-form", () => ({
  DeleteIdeaForm: (props: Record<string, unknown>) => <pre data-delete>{JSON.stringify(props)}</pre>,
}));

type Props = { params: Promise<{ tripId: string; ideaId?: string }> };

// Each page keeps its work in a component inside Suspense, so run that component directly.
async function run(page: (props: never) => unknown, ideaId?: string) {
  const element = (page as (props: Props) => ReactElement<{ children: ReactElement<Props> }>)({
    params: Promise.resolve({ tripId: "trip-1", ideaId }),
  });
  const content = element.props.children;
  const render = content.type as (props: Props) => Promise<ReactElement>;
  // The mocked forms print their props as JSON, which the markup escapes; read it back plainly.
  return renderToStaticMarkup(await render(content.props)).replaceAll("&quot;", '"');
}

const trip = { id: "trip-1", name: "Hội An long weekend", currency: "VND", ownerId: "owner" };

const idea = (extra = {}) => ({
  id: "idea-1",
  name: "Chợ Bến Thành",
  type: "sightseeing",
  duration: "half",
  link: "https://maps.app.goo.gl/abc",
  area: "District 1",
  costPerPerson: 120,
  costCurrency: "VND",
  notes: "Go early.",
  createdAt: new Date(),
  addedBy: { id: "u1", name: "Maya", image: null },
  canChange: true,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.getIdeaForMember.mockResolvedValue(idea());
});

describe("Add an idea page", () => {
  it("shows not found to someone who is not in the trip", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run(AddIdeaPage)).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("sends a signed-out visitor away before looking up the trip", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run(AddIdeaPage)).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("gives a member the band, back to the Ideas tab, and an empty form with the trip's currency", async () => {
    const html = await run(AddIdeaPage);
    expect(html).toContain(">Add an idea</h1>");
    expect(html).toContain('href="/trips/trip-1/ideas"');
    expect(html).toContain("Hội An long weekend");
    expect(html).not.toContain("Trip sections"); // no tab bar on a task page
    expect(html).toContain('"mode":"create"');
    expect(html).toContain('"tripId":"trip-1"');
    expect(html).toContain('"currency":"VND"');
    expect(html).toContain('"name":""');
  });
});

describe("Edit idea page", () => {
  it("checks the idea within this trip for the signed-in person", async () => {
    await run(EditIdeaPage, "idea-1");
    expect(mocks.getIdeaForMember).toHaveBeenCalledWith("trip-1", "idea-1", "u1");
  });

  it.each([
    ["is not in the trip", { trip: null }],
    ["does not exist", { idea: null }],
    ["may not change it (not the adder or the owner)", { idea: idea({ canChange: false }) }],
  ])("shows not found when the person %s", async (_label, change) => {
    if ("trip" in change) mocks.getTripForMember.mockResolvedValue(change.trip);
    if ("idea" in change) mocks.getIdeaForMember.mockResolvedValue(change.idea);
    await expect(run(EditIdeaPage, "idea-1")).rejects.toThrow("not-found");
  });

  it("sends a signed-out visitor away first", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run(EditIdeaPage, "idea-1")).rejects.toThrow("redirect:/");
    expect(mocks.getIdeaForMember).not.toHaveBeenCalled();
  });

  it("fills the form with the idea exactly, and offers Delete idea", async () => {
    const html = await run(EditIdeaPage, "idea-1");
    expect(html).toContain(">Edit idea</h1>");
    expect(html).toContain('"mode":"edit"');
    expect(html).toContain('"ideaId":"idea-1"');
    expect(html).toContain('"name":"Chợ Bến Thành"');
    expect(html).toContain('"costPerPerson":"120"');
    expect(html).toContain('"type":"sightseeing"');
    expect(html).toContain('href="/trips/trip-1/ideas/idea-1/delete"');
    expect(html).toContain("Delete idea");
  });

  it("shows empty text for the optional fields that were left blank", async () => {
    mocks.getIdeaForMember.mockResolvedValue(
      idea({ link: null, area: null, costPerPerson: null, notes: null }),
    );
    const html = await run(EditIdeaPage, "idea-1");
    expect(html).toContain('"link":""');
    expect(html).toContain('"area":""');
    expect(html).toContain('"costPerPerson":""');
    expect(html).toContain('"notes":""');
  });

  it("lets the trip owner in, because canChange says so", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "owner", name: "Owner", image: null });
    mocks.getIdeaForMember.mockResolvedValue(idea({ canChange: true, addedBy: { id: "u9", name: "Ben", image: null } }));
    await expect(run(EditIdeaPage, "idea-1")).resolves.toContain("Chợ Bến Thành");
  });
});

describe("Delete idea page", () => {
  it.each([
    ["is not in the trip", { trip: null }],
    ["does not exist", { idea: null }],
    ["may not change it", { idea: idea({ canChange: false }) }],
  ])("shows not found when the person %s", async (_label, change) => {
    if ("trip" in change) mocks.getTripForMember.mockResolvedValue(change.trip);
    if ("idea" in change) mocks.getIdeaForMember.mockResolvedValue(change.idea);
    await expect(run(DeleteIdeaPage, "idea-1")).rejects.toThrow("not-found");
  });

  it("asks once, with Keep idea as the main way back and the delete form beside it", async () => {
    const html = await run(DeleteIdeaPage, "idea-1");
    expect(html).toContain("Delete Chợ Bến Thành?");
    expect(html).toContain("This deletes it for good. You can&#x27;t undo this.");
    expect(html).toContain(">Keep idea<");
    expect(html).toContain('href="/trips/trip-1/ideas/idea-1/edit"');
    expect(html).toContain('"tripId":"trip-1"');
    expect(html).toContain('"ideaId":"idea-1"');
    expect(html).toContain(">Delete idea</h1>");
    expect(html).not.toContain("Trip sections");
  });
});

describe("the address 'new'", () => {
  it("is its own folder next to [ideaId], so it is never read as an idea id", () => {
    const base = "src/app/trips/[tripId]/ideas";
    expect(existsSync(`${base}/new/page.tsx`)).toBe(true);
    expect(existsSync(`${base}/[ideaId]/edit/page.tsx`)).toBe(true);
    // There is no page at [ideaId] itself, so /ideas/new can't land in the idea routes.
    expect(existsSync(`${base}/[ideaId]/page.tsx`)).toBe(false);
  });
});
