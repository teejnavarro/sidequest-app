import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToToday } from "./scroll-to-today";

// These tests run without a browser, so the effect runs straight away and the page is a
// small stand-in: an address, a reduced-motion setting and today's card.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
}));

const page = vi.hoisted(() => ({
  hash: "",
  reduceMotion: false,
  cards: new Map<string, { scrollIntoView: ReturnType<typeof vi.fn> }>(),
}));

const card = (day: string) => {
  const element = { scrollIntoView: vi.fn() };
  page.cards.set(`day-${day}`, element);
  return element;
};

beforeEach(() => {
  page.hash = "";
  page.reduceMotion = false;
  page.cards.clear();
  vi.stubGlobal("window", {
    location: {
      get hash() {
        return page.hash;
      },
    },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && page.reduceMotion,
    }),
  });
  vi.stubGlobal("document", { getElementById: (id: string) => page.cards.get(id) ?? null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ScrollToToday", () => {
  it("glides today's card to the top and draws nothing", () => {
    const today = card("2027-05-10");
    const other = card("2027-05-09");
    expect(ScrollToToday({ day: "2027-05-10" })).toBeNull();
    expect(today.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(other.scrollIntoView).not.toHaveBeenCalled();
  });

  it("jumps instead of gliding when the phone is set to reduce motion", () => {
    page.reduceMotion = true;
    const today = card("2027-05-10");
    ScrollToToday({ day: "2027-05-10" });
    expect(today.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
  });

  it("leaves the page alone when the address names a day, so coming back from Add or Move wins", () => {
    page.hash = "#day-2027-05-09";
    const today = card("2027-05-10");
    ScrollToToday({ day: "2027-05-10" });
    expect(today.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing when today's card is not on the page", () => {
    expect(() => ScrollToToday({ day: "2027-05-10" })).not.toThrow();
  });
});
