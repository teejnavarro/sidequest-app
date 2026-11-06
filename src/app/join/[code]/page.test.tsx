import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import JoinPage, { metadata } from "./page";

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";

const mocks = vi.hoisted(() => ({
  getOptionalUser: vi.fn(),
  getTripByInviteCode: vi.fn(),
  isTripMember: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/lib/current-user", () => ({ getOptionalUser: mocks.getOptionalUser }));
vi.mock("@/lib/trips", () => ({
  getTripByInviteCode: mocks.getTripByInviteCode,
  isTripMember: mocks.isTripMember,
}));
vi.mock("./join-view", () => ({ JoinView: () => null }));

const invited = {
  id: "trip-1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  destination: null,
  ownerName: "Maya Cruz",
  members: [],
};

type JoinViewProps = { invited: typeof invited; code: string; signedIn: boolean };

// The page's decisions live in a component inside Suspense, so run that component directly.
async function openInvite(code: string) {
  const page = JoinPage({
    params: Promise.resolve({ code }),
  } as Parameters<typeof JoinPage>[0]) as ReactElement<{ children: [ReactElement, ReactElement<{ children: ReactElement }>] }>;
  // The page is the Sidequest wordmark, then the Suspense that holds the content.
  const content = page.props.children[1].props.children as ReactElement<{ params: Promise<{ code: string }> }>;
  const render = content.type as (props: { params: Promise<{ code: string }> }) => Promise<ReactElement<JoinViewProps>>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTripByInviteCode.mockResolvedValue(invited);
  mocks.getOptionalUser.mockResolvedValue(null);
  mocks.isTripMember.mockResolvedValue(false);
});

describe("the invite page's fixed details", () => {
  it("keeps the trip out of the page title and out of search engines", () => {
    expect(metadata.title).toBe("You're invited | Sidequest");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toBeUndefined();
  });
});

describe("opening an invite", () => {
  it("turns away a wrong-shaped code without asking the database", async () => {
    await expect(openInvite("abc")).rejects.toThrow("not-found");
    expect(mocks.getTripByInviteCode).not.toHaveBeenCalled();
  });

  it("gives an unknown code the same not-found answer", async () => {
    mocks.getTripByInviteCode.mockResolvedValue(null);
    await expect(openInvite(CODE)).rejects.toThrow("not-found");
    expect(mocks.getOptionalUser).not.toHaveBeenCalled();
  });

  it("shows a signed-out visitor the signed-out view", async () => {
    const view = await openInvite(CODE);
    expect(view.props).toEqual({ invited, code: CODE, signedIn: false });
    expect(mocks.isTripMember).not.toHaveBeenCalled();
  });

  it("sends an existing member straight to the trip", async () => {
    mocks.getOptionalUser.mockResolvedValue({ id: "u1", name: "Maya Cruz", image: null });
    mocks.isTripMember.mockResolvedValue(true);
    await expect(openInvite(CODE)).rejects.toThrow("redirect:/trips/trip-1/schedule");
    expect(mocks.isTripMember).toHaveBeenCalledWith("trip-1", "u1");
  });

  it("offers a signed-in non-member the signed-in view with Join trip", async () => {
    mocks.getOptionalUser.mockResolvedValue({ id: "u2", name: "Ben Reyes", image: null });
    const view = await openInvite(CODE);
    expect(view.props).toEqual({ invited, code: CODE, signedIn: true });
  });

  it("accepts an upper-case link and carries the lower-case code", async () => {
    const view = await openInvite(CODE.toUpperCase());
    expect(mocks.getTripByInviteCode).toHaveBeenCalledWith(CODE.toUpperCase());
    expect(view.props.code).toBe(CODE);
  });
});
