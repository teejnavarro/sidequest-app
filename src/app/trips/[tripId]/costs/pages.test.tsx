import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogCostPage from "./new/page";
import EditCostPage from "./[costId]/edit/page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getTripForMember: vi.fn(),
  listCostPeople: vi.fn(),
  getCostForMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getTripForMember: mocks.getTripForMember,
  listCostPeople: mocks.listCostPeople,
}));
vi.mock("@/lib/costs", () => ({ getCostForMember: mocks.getCostForMember }));
// Show the forms' props as text, so the pages' choices can be read.
vi.mock("@/components/cost-form", () => ({
  CostForm: (props: Record<string, unknown>) => <pre data-form>{JSON.stringify(props)}</pre>,
}));

type Props = { params: Promise<{ tripId: string; costId?: string }> };

// Each page keeps its work in a component inside Suspense, so run that component directly.
async function run(page: (props: never) => unknown, costId?: string) {
  const element = (page as (props: Props) => ReactElement<{ children: ReactElement<Props> }>)({
    params: Promise.resolve({ tripId: "trip-1", costId }),
  });
  const content = element.props.children;
  const render = content.type as (props: Props) => Promise<ReactElement>;
  return renderToStaticMarkup(await render(content.props));
}

// The mocked form prints its props as JSON, which the markup escapes; read it back plainly.
const formProps = (html: string) =>
  JSON.parse(
    html
      .match(/<pre data-form[^>]*>(.*?)<\/pre>/)![1]
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  );

const trip = {
  id: "trip-1",
  name: "Saigon barkada",
  startDate: "2027-05-08",
  endDate: "2027-05-11",
  timeZone: "Asia/Manila",
  currency: "PHP",
};

const members = [
  { id: "u1", spotId: "a", name: "Maya Cruz", image: null, isGuest: false, hasLeft: false },
  { id: "u2", spotId: "b", name: "Ben Lim", image: null, isGuest: false, hasLeft: false },
  { id: "g", spotId: "g", name: "Dana Reyes", image: null, isGuest: true, hasLeft: false },
];

const cost = {
  id: "cost-1",
  description: "Dinner <b>",
  amount: 125050,
  currency: "PHP",
  category: "food",
  spentOn: "2027-05-09",
  paidBy: "b",
  shares: [
    { spotId: "a", amount: 62525 },
    { spotId: "b", amount: 62525 },
  ],
  updatedAt: new Date("2027-05-09T10:00:00.123Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-05-09T20:00:00Z")); // already May 10 in Manila
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
  mocks.getTripForMember.mockResolvedValue(trip);
  mocks.listCostPeople.mockResolvedValue(members);
  mocks.getCostForMember.mockResolvedValue(cost);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Log a cost page", () => {
  it("checks membership itself and shows not found to a stranger", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run(LogCostPage)).rejects.toThrow("not-found");
    expect(mocks.getTripForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.listCostPeople).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(run(LogCostPage)).rejects.toThrow("redirect:/");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
  });

  it("starts paid by you, split between everyone, dated today in the trip's own zone", async () => {
    const html = await run(LogCostPage);
    expect(html).toContain("Log a cost");
    const props = formProps(html);
    expect(props).toMatchObject({
      mode: "new",
      tripId: "trip-1",
      currency: "PHP",
      updatedAt: "",
      values: { paidBy: "a", sharedBy: ["a", "b", "g"], spentOn: "2027-05-10", description: "", amount: "", category: "" },
    });
    expect(props.costId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses the trip's first day while the trip has not started", async () => {
    vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
    expect(formProps(await run(LogCostPage)).values.spentOn).toBe("2027-05-08");
  });

  it("offers guests next to members, with first names and the Guest flag", async () => {
    const people = formProps(await run(LogCostPage)).people;
    expect(people.map((p: { name: string; isGuest: boolean; isYou: boolean }) => [p.name, p.isGuest, p.isYou])).toEqual([
      ["Maya", false, true],
      ["Ben", false, false],
      ["Dana", true, false],
    ]);
  });

  it("asks for the people without a cost id, so nobody who left is offered", async () => {
    await run(LogCostPage);
    expect(mocks.listCostPeople).toHaveBeenCalledWith("trip-1", "u1", null);
  });

  it("makes a new id each time the page is opened", async () => {
    const one = formProps(await run(LogCostPage)).costId;
    const two = formProps(await run(LogCostPage)).costId;
    expect(one).not.toBe(two);
  });
});

describe("Edit cost page, people who left", () => {
  it("asks for the people with the cost id and passes on who left", async () => {
    mocks.listCostPeople.mockResolvedValue([
      ...members,
      { id: "u3", spotId: "l", name: "Lou Tan", image: null, isGuest: false, hasLeft: true },
    ]);
    const people = formProps(await run(EditCostPage, "cost-1")).people;
    expect(mocks.listCostPeople).toHaveBeenCalledWith("trip-1", "u1", "cost-1");
    expect(people.map((p: { name: string; hasLeft: boolean }) => [p.name, p.hasLeft])).toEqual([
      ["Maya", false],
      ["Ben", false],
      ["Dana", false],
      ["Lou", true],
    ]);
  });
});

describe("Edit cost page", () => {
  it("checks membership itself, and a missing cost looks the same as a stranger", async () => {
    mocks.getTripForMember.mockResolvedValue(null);
    await expect(run(EditCostPage, "cost-1")).rejects.toThrow("not-found");
    mocks.getTripForMember.mockResolvedValue(trip);
    mocks.getCostForMember.mockResolvedValue(null);
    await expect(run(EditCostPage, "cost-1")).rejects.toThrow("not-found");
    expect(mocks.getCostForMember).toHaveBeenCalledWith("trip-1", "cost-1", "u1");
  });

  it("fills the form from the saved cost, with the time it was last saved, and offers Delete cost", async () => {
    const html = await run(EditCostPage, "cost-1");
    expect(html).toContain("Edit cost");
    expect(formProps(html)).toMatchObject({
      mode: "edit",
      costId: "cost-1",
      currency: "PHP",
      updatedAt: "2027-05-09T10:00:00.123Z",
      values: {
        description: "Dinner <b>",
        amount: "1250.50",
        paidBy: "b",
        sharedBy: ["a", "b"],
        spentOn: "2027-05-09",
        category: "food",
      },
    });
    expect(html).toContain('href="/trips/trip-1/costs/cost-1/delete"');
    expect(html).toContain("Delete cost");
  });

  it("lists guests in both pickers and shows a zero-decimal cost without decimals", async () => {
    mocks.getCostForMember.mockResolvedValue({ ...cost, currency: "VND", amount: 250000 });
    const props = formProps(await run(EditCostPage, "cost-1"));
    expect(props.people.some((p: { isGuest: boolean }) => p.isGuest)).toBe(true);
    expect(props.values.amount).toBe("250000");
  });
});
