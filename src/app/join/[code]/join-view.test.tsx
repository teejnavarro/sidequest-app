import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JoinView } from "./join-view";

vi.mock("../actions", () => ({ signInToJoin: async () => {} }));
vi.mock("./join-form", () => ({
  JoinForm: ({ guests }: { guests?: unknown[] }) => (
    <button data-guests={guests?.length ?? 0}>Join trip</button>
  ),
}));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";

const invited = {
  id: "t1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  destination: "Hội An, Việt Nam",
  ownerName: "Maya Owner",
  members: [
    { id: "u1", spotId: "s1", name: "Maya Owner", image: null, isGuest: false, addedById: null, addedByName: null, hasLeft: false },
    { id: "u2", spotId: "s2", name: "Benedict Secretname", image: null, isGuest: false, addedById: null, addedByName: null, hasLeft: false },
    { id: "u3", spotId: "s3", name: "Corazon Hiddenperson", image: null, isGuest: false, addedById: null, addedByName: null, hasLeft: false },
  ],
};

describe("the invite page for a signed-out visitor", () => {
  const html = renderToStaticMarkup(<JoinView invited={invited} code={CODE} signedIn={false} />);

  it("shows the trip name, destination, dates, the count and the owner's name", () => {
    expect(html).toContain("You&#x27;re invited to Hội An long weekend");
    expect(html).toContain("Hội An, Việt Nam");
    expect(html).toContain("Mar 12");
    expect(html).toContain("Mar 15, 2027");
    expect(html).toContain("3 people are going");
    expect(html).toContain("Trip owner: Maya Owner");
    expect(html).toContain("Continue with Google");
  });

  it("never prints another member's name, in text or in alt text and labels", () => {
    expect(html).not.toContain("Benedict");
    expect(html).not.toContain("Secretname");
    expect(html).not.toContain("Corazon");
    expect(html).not.toContain("Hiddenperson");
    // The decorative circles carry no labels at all.
    expect(html).not.toContain("aria-label");
    expect(html).not.toMatch(/alt="[^"]/);
  });

  it("still shows the circles, as initials, and offers no join button yet", () => {
    expect(html).toContain("MO");
    expect(html).toContain("BS");
    expect(html).not.toContain("Join trip</button>");
  });

  it("says one person, not one people", () => {
    const one = renderToStaticMarkup(
      <JoinView invited={{ ...invited, members: [invited.members[0]] }} code={CODE} signedIn={false} />,
    );
    expect(one).toContain("1 person is going");
  });

  it("shows nothing for an empty destination", () => {
    const none = renderToStaticMarkup(
      <JoinView invited={{ ...invited, destination: null }} code={CODE} signedIn={false} />,
    );
    expect(none).not.toContain("Hội An, Việt Nam");
  });
});

describe("the invite page for a signed-in person", () => {
  const html = renderToStaticMarkup(<JoinView invited={invited} code={CODE} signedIn />);

  it("shows the same details with named faces and the Join trip button", () => {
    expect(html).toContain("Hội An long weekend");
    expect(html).toContain("Hội An, Việt Nam");
    expect(html).toContain('aria-label="Benedict Secretname"');
    expect(html).toContain("Join trip");
    expect(html).not.toContain("Continue with Google");
  });
});

describe("the invite page when the trip has guests", () => {
  const withGuests = {
    ...invited,
    members: [
      ...invited.members,
      { id: "g1", spotId: "g1", name: "Lito Guestname", image: null, isGuest: true, addedById: "u1", addedByName: "Maya Owner", hasLeft: false },
    ],
  };

  it("signed out: the guest is one more circle in the count and no name appears anywhere", () => {
    const html = renderToStaticMarkup(<JoinView invited={withGuests} code={CODE} signedIn={false} />);
    expect(html).toContain("4 people are going");
    expect(html).not.toContain("Lito");
    expect(html).not.toContain("Guestname");
  });

  it("draws the guest's circle in plain gray and keeps people's colors, signed out or in", () => {
    for (const signedIn of [false, true]) {
      const html = renderToStaticMarkup(<JoinView invited={withGuests} code={CODE} signedIn={signedIn} />);
      expect(html.match(/bg-chip text-ink/g)).toHaveLength(1);
      expect(html.match(/text-on-face/g)).toHaveLength(3);
    }
  });

  it("signed out: guest names are not shown even if some caller passed them", () => {
    const html = renderToStaticMarkup(
      <JoinView invited={withGuests} code={CODE} signedIn={false} guests={[{ id: "g1", name: "Lito Guestname" }]} />,
    );
    expect(html).not.toContain("Lito");
  });

  it("signed in: passes the guests to the join form", () => {
    const html = renderToStaticMarkup(
      <JoinView invited={withGuests} code={CODE} signedIn guests={[{ id: "g1", name: "Lito Guestname" }]} />,
    );
    expect(html).toContain('data-guests="1"');
  });
});

describe("the invite page's explanation", () => {
  const out = renderToStaticMarkup(<JoinView invited={invited} code={CODE} signedIn={false} />);
  const inn = renderToStaticMarkup(<JoinView invited={invited} code={CODE} signedIn />);

  it("says what Sidequest is, signed out and signed in", () => {
    expect(out).toContain("Sidequest keeps your group&#x27;s plans and shared costs in one place.");
    expect(inn).toContain("Sidequest keeps your group&#x27;s plans and shared costs in one place.");
  });

  it("keeps You're invited to in both views, and the Trip owner line", () => {
    expect(out).toContain("You&#x27;re invited to Hội An long weekend");
    expect(inn).toContain("You&#x27;re invited to Hội An long weekend");
    expect(out).toContain("Trip owner: Maya Owner");
    expect(inn).toContain("Trip owner: Maya Owner");
  });

  it("lets a long word wrap in the trip owner line instead of widening the page", () => {
    expect(out).toMatch(/<p class="[^"]*wrap-anywhere[^"]*">Trip owner:/);
  });

  it("tells a signed-out visitor to tap Join trip after signing in", () => {
    expect(out).toContain("After signing in, tap Join trip.");
    expect(inn).not.toContain("After signing in, tap Join trip.");
  });

  it("still shows no name beyond the owner's when signed out", () => {
    expect(out).not.toContain("Benedict");
    expect(out).not.toContain("Corazon");
  });
});
