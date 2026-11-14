import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteCostPage from "./[costId]/delete/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  getCostForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({ getTripForMember: mocks.getTripForMember }));
vi.mock("@/lib/costs", () => ({ getCostForMember: mocks.getCostForMember }));
vi.mock("./[costId]/delete/delete-form", () => ({
  DeleteCostForm: (props: Record<string, unknown>) => <pre data-delete>{JSON.stringify(props)}</pre>,
}));

type Props = { params: Promise<{ tripId: string; costId: string }> };

// The page keeps its work in a component inside Suspense, so run that component directly.
async function run() {
  const element = (DeleteCostPage as unknown as (props: Props) => ReactElement<{ children: ReactElement<Props> }>)({
    params: Promise.resolve({ tripId: "trip-1", costId: "cost-1" }),
  });
  const content = element.props.children;
  const render = content.type as (props: Props) => Promise<ReactElement>;
  return renderToStaticMarkup(await render(content.props));
}

const trip = { id: "trip-1", name: "Saigon barkada" };
const cost = { id: "cost-1", description: "Dinner <b>" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.getCostForMember.mockResolvedValue(cost);
});

describe("Delete cost page", () => {
  it("checks membership itself and shows not found for a stranger or a missing cost", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run()).rejects.toThrow("not-found");
    mocks.getTripForMember.mockResolvedValue(trip);
    mocks.getCostForMember.mockResolvedValue(null);
    await expect(run()).rejects.toThrow("not-found");
  });

  it("asks first, with Keep cost as the main button and Delete cost as the red one", async () => {
    const html = await run();
    expect(html).toContain("Delete Dinner &lt;b&gt;?");
    expect(html).toContain("This deletes it for everyone. You can&#x27;t undo this.");
    const keep = html.match(/<a [^>]*href="\/trips\/trip-1\/costs\/cost-1\/edit"[^>]*>Keep cost<\/a>/)?.[0] ?? "";
    expect(keep).toContain("bg-amber");
    expect(html).toContain("data-delete");
    expect(html).toContain("&quot;costId&quot;:&quot;cost-1&quot;");
    expect(html.indexOf("Keep cost")).toBeLessThan(html.indexOf("data-delete"));
  });
});
