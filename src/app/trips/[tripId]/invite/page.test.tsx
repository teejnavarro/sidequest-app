import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InvitePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getInviteCodeForMember: vi.fn(),
  getTripForMember: vi.fn(),
  listTripMembers: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/trips", () => ({
  getInviteCodeForMember: mocks.getInviteCodeForMember,
  getTripForMember: mocks.getTripForMember,
  listTripMembers: mocks.listTripMembers,
}));
vi.mock("@/components/invite-actions", () => ({ InviteActions: () => null }));
vi.mock("@/components/face", () => ({ Face: () => null }));
vi.mock("@/components/add-guest-form", () => ({
  AddGuestForm: ({ tripId }: { tripId: string }) => <form data-add-guest={tripId} />,
}));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";
const props = {
  params: Promise.resolve({ tripId: "trip-1" }),
} as Parameters<typeof InvitePage>[0];

// The page keeps its data in a component inside Suspense, so run that component directly.
async function renderContent() {
  const page = InvitePage(props) as ReactElement<{ children: ReactElement<{ params: Promise<{ tripId: string }> }> }>;
  const content = page.props.children;
  const render = content.type as (props: typeof content.props) => Promise<ReactElement>;
  return render(content.props);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "u1", name: "Maya", image: null });
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
});

// The layout's check does not protect this page, so the page must check for itself.
describe("InvitePage", () => {
  it("shows not found to someone who is not a member, and reads nothing else", async () => {
    mocks.getInviteCodeForMember.mockResolvedValue(null);
    await expect(renderContent()).rejects.toThrow("not-found");
    expect(mocks.getInviteCodeForMember).toHaveBeenCalledWith("trip-1", "u1");
    expect(mocks.getTripForMember).not.toHaveBeenCalled();
    expect(mocks.listTripMembers).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor away before looking anything up", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("redirect:/"));
    await expect(renderContent()).rejects.toThrow("redirect:/");
    expect(mocks.getInviteCodeForMember).not.toHaveBeenCalled();
  });

  const member = (id: string, name: string) => ({
    id,
    spotId: `s-${id}`,
    name,
    image: null,
    isGuest: false,
    addedById: null as string | null,
    addedByName: null as string | null,
  });
  const guest = (spotId: string, name: string, addedById: string, addedByName: string) => ({
    ...member(spotId, name),
    id: spotId,
    spotId,
    isGuest: true,
    addedById,
    addedByName,
  });

  async function renderFor(members: ReturnType<typeof member>[]) {
    mocks.getInviteCodeForMember.mockResolvedValue(CODE);
    mocks.getTripForMember.mockResolvedValue({ id: "trip-1", name: "Hội An", ownerId: "u1" });
    mocks.listTripMembers.mockResolvedValue(members);
    return renderToStaticMarkup(await renderContent());
  }

  it("gives a member the short band, the whole link and who is in", async () => {
    const html = await renderFor([member("u1", "Maya"), member("u2", "Ben")]);
    expect(html).toContain("Invite people");
    expect(html).toContain('href="/trips/trip-1/schedule"'); // back link goes to the trip
    expect(html).toContain("Hội An"); // and names it
    expect(html).toContain(`http://localhost:3000/join/${CODE}`); // the whole link stays in the page
    expect(html).toMatch(/<p class="truncate[^"]*select-all">http/); // shown on one shortened line
    expect(html).toContain("2 people are in");
    expect(html).toContain("Maya");
    expect(html).toContain("Ben");
  });

  it("marks only the owner with a quiet Owner tag, with no brackets", async () => {
    const html = await renderFor([member("u1", "Maya"), member("u2", "Ben")]);
    expect(html.match(/>Owner</g)).toHaveLength(1);
    expect(html).not.toMatch(/\(\s*owner\s*\)/i);
  });

  it("says 1 person is in when it is just the owner", async () => {
    expect(await renderFor([member("u1", "Maya")])).toContain("1 person is in");
  });

  describe("guests", () => {
    const people = [
      member("u1", "Maya"),
      member("u2", "Ben Santos"),
      guest("g1", "Lito", "u2", "Ben Santos"),
      guest("g2", "Tita Carmen", "u1", "Maya Reyes"),
    ];

    it("lists guests in order with a Guest tag and who added them, and counts them", async () => {
      const html = await renderFor(people);
      expect(html).toContain("4 people are in");
      expect(html.match(/>Guest</g)).toHaveLength(2);
      expect(html.indexOf("Maya")).toBeLessThan(html.indexOf("Lito"));
      expect(html.indexOf("Lito")).toBeLessThan(html.indexOf("Tita Carmen"));
      expect(html).toContain("Added by Ben");
      expect(html).toContain("Added by Maya");
      expect(html.match(/>Owner</g)).toHaveLength(1);
    });

    it("gives the people card the people anchor and the add form for this trip", async () => {
      const html = await renderFor(people);
      expect(html).toContain('id="people"');
      expect(html).toContain('data-add-guest="trip-1"');
    });

    it("shows edit links to the owner for every guest", async () => {
      // The viewer (u1) owns the trip.
      const html = await renderFor(people);
      expect(html).toContain('href="/trips/trip-1/guests/g1/edit"');
      expect(html).toContain('href="/trips/trip-1/guests/g2/edit"');
    });

    it("shows an edit link to the adder only for their own guest", async () => {
      mocks.getCurrentUser.mockResolvedValue({ id: "u2", name: "Ben", image: null });
      const html = await renderFor(people);
      expect(html).toContain('href="/trips/trip-1/guests/g1/edit"');
      expect(html).not.toContain("/guests/g2/edit");
      expect(html).toContain("Tita Carmen"); // still listed, just not a link
    });

    it("shows no edit links to a member who neither added a guest nor owns the trip", async () => {
      mocks.getCurrentUser.mockResolvedValue({ id: "u3", name: "Jo", image: null });
      const html = await renderFor([...people, member("u3", "Jo")]);
      expect(html).not.toContain("/edit");
    });

    it("wraps a long guest name in its row, linked or not, instead of widening the page", async () => {
      const long = [member("u1", "Maya"), guest("g9", "W".repeat(40), "u1", "Maya")];
      const nameSpan = /<span class="grid min-w-0 flex-1"><span class="min-w-0 wrap-anywhere">W{40}<\/span>/;

      const asOwner = await renderFor(long); // a link to Edit guest
      expect(asOwner).toMatch(/<a [^>]*class="[^"]*\bmin-w-0\b[^"]*"[^>]*>(?:(?!<\/a>).)*W{40}/);
      expect(asOwner).toMatch(nameSpan);

      mocks.getCurrentUser.mockResolvedValue({ id: "u3", name: "Jo", image: null });
      const asOther = await renderFor([...long, member("u3", "Jo")]); // a plain row
      expect(asOther).toMatch(/<div class="[^"]*\bmin-w-0\b[^"]*">(?:(?!<\/div>).)*W{40}/);
      expect(asOther).toMatch(nameSpan);
    });

    it("never makes a signed-in person's row a link, even for the owner", async () => {
      const html = await renderFor(people);
      expect(html).not.toContain("/guests/s-u2/edit");
      expect(html).not.toContain("/guests/s-u1/edit");
    });
  });
});
