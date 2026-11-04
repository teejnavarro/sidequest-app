import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import TripPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

type GoProps = { params: Promise<{ tripId: string }> };

describe("TripPage", () => {
  it("sends /trips/<id> to the Schedule tab", async () => {
    const page = TripPage({
      params: Promise.resolve({ tripId: "trip-1" }),
    } as Parameters<typeof TripPage>[0]) as ReactElement<{ children: ReactElement<GoProps> }>;
    const go = page.props.children;
    const render = go.type as (props: GoProps) => Promise<never>;
    await expect(render(go.props)).rejects.toThrow("redirect:/trips/trip-1/schedule");
  });
});
