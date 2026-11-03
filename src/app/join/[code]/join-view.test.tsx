import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JoinView } from "./join-view";

vi.mock("../actions", () => ({ signInToJoin: async () => {} }));
vi.mock("./join-form", () => ({ JoinForm: () => <button>Join trip</button> }));

const CODE = "3f2b8c1e-9a4d-4e7b-8c11-5d6a7b9e0f12";

const invited = {
  id: "t1",
  name: "Hội An long weekend",
  startDate: "2027-03-12",
  endDate: "2027-03-15",
  destination: "Hội An, Việt Nam",
  ownerName: "Maya Owner",
  members: [
    { id: "u1", name: "Maya Owner", image: null },
    { id: "u2", name: "Benedict Secretname", image: null },
    { id: "u3", name: "Corazon Hiddenperson", image: null },
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
    expect(html).not.toContain("Join trip");
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
