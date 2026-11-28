import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoryMotion } from "./story-motion";

// These tests run without a browser, so the effect runs straight away (its clean-up is kept)
// and the page is a small stand-in: a screen, a reduced-motion setting, the tickets, the
// journey and its plane.
const page = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
  reduceMotion: false,
  screenHeight: 800,
  frames: [] as (() => void)[],
  listeners: new Map<string, () => void>(),
  observed: [] as unknown[],
  onIntersect: undefined as undefined | ((entries: { isIntersecting: boolean; target: unknown }[]) => void),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => {
    page.cleanup = effect() ?? undefined;
  },
}));

type Fake = { classList: Set<string> & { contains(name: string): boolean; remove(name: string): void } };

function classes() {
  const set = new Set<string>() as Fake["classList"];
  set.contains = (name) => set.has(name);
  set.remove = (name) => set.delete(name);
  return set;
}

// A ticket whose top edge sits `top` pixels from the top of the screen.
const ticket = (top: number) => ({ classList: classes(), getBoundingClientRect: () => ({ top }) });

let html: Fake;
let tickets: ReturnType<typeof ticket>[];
let journey: { getBoundingClientRect: () => { top: number; height: number } };
let plane: { offsetHeight: number; style: Record<string, string> & { removeProperty(name: string): void } };
// What the class list of <html> held at the moment each ticket got "in".
let htmlWhenIn: Map<unknown, boolean>;

function setUp(ticketTops: number[], journeyTop = 300) {
  tickets = ticketTops.map(ticket);
  htmlWhenIn = new Map();
  for (const t of tickets) {
    const add = t.classList.add.bind(t.classList);
    t.classList.add = (name: string) => {
      if (name === "in") htmlWhenIn.set(t, html.classList.has("story-js"));
      return add(name);
    };
  }
  journey = { getBoundingClientRect: () => ({ top: journeyTop, height: 2000 }) };
}

beforeEach(() => {
  page.cleanup = undefined;
  page.reduceMotion = false;
  page.frames = [];
  page.listeners.clear();
  page.observed = [];
  page.onIntersect = undefined;
  html = { classList: classes() };
  plane = {
    offsetHeight: 28,
    style: {
      removeProperty(this: Record<string, string>, name: string) {
        delete this[name];
      },
    } as typeof plane.style,
  };
  setUp([100, 700, 1200, 1800]);

  vi.stubGlobal("window", {
    get innerHeight() {
      return page.screenHeight;
    },
    matchMedia: (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && page.reduceMotion,
    }),
    addEventListener: (name: string, listener: () => void) => page.listeners.set(name, listener),
    removeEventListener: (name: string) => page.listeners.delete(name),
  });
  vi.stubGlobal("document", {
    documentElement: html,
    querySelectorAll: () => tickets,
    querySelector: (selector: string) =>
      selector === ".story-journey" ? journey : selector === ".story-plane" ? plane : null,
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof page.onIntersect) {
        page.onIntersect = callback;
      }
      observe(target: unknown) {
        page.observed.push(target);
      }
      unobserve(target: unknown) {
        page.observed = page.observed.filter((item) => item !== target);
      }
      disconnect() {
        page.observed = [];
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", (frame: () => void) => page.frames.push(frame));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StoryMotion with reduce motion on", () => {
  it("hides nothing and moves nothing", () => {
    page.reduceMotion = true;
    expect(StoryMotion()).toBeNull();
    expect(html.classList.has("story-js")).toBe(false);
    expect(page.observed).toHaveLength(0);
    expect(page.listeners.size).toBe(0);
    expect(plane.style.top).toBeUndefined();
  });
});

describe("StoryMotion", () => {
  it("shows what is already on screen before it turns the fade on, so nothing flashes", () => {
    setUp([-400, 100, 799, 800, 1500]);
    StoryMotion();
    expect(html.classList.has("story-js")).toBe(true);
    // Above and on the screen: visible, and marked before story-js went on <html>.
    for (const t of tickets.slice(0, 3)) {
      expect(t.classList.has("in")).toBe(true);
      expect(htmlWhenIn.get(t)).toBe(false);
    }
    // Below the screen: left for the observer.
    expect(tickets[3].classList.has("in")).toBe(false);
    expect(page.observed).toEqual([tickets[3], tickets[4]]);
  });

  it("fades a ticket in once it scrolls into view, and only then", () => {
    StoryMotion();
    const below = tickets[2];
    page.onIntersect!([{ isIntersecting: false, target: below }]);
    expect(below.classList.has("in")).toBe(false);
    page.onIntersect!([{ isIntersecting: true, target: below }]);
    expect(below.classList.has("in")).toBe(true);
    expect(page.observed).not.toContain(below);
  });

  it("keeps the plane 45% down the screen, on the line", () => {
    let journeyTop = 500;
    journey = { getBoundingClientRect: () => ({ top: journeyTop, height: 2000 }) };
    StoryMotion();
    // At the page top the journey starts below the 45% mark: the plane waits at the start.
    expect(plane.style.top).toBe("0px");

    journeyTop = -500;
    page.listeners.get("scroll")!();
    page.frames.shift()!();
    expect(plane.style.top).toBe(`${800 * 0.45 + 500}px`);

    // Past the end of the line it stops at the end (line height minus the plane).
    journeyTop = -5000;
    page.listeners.get("scroll")!();
    page.frames.shift()!();
    expect(plane.style.top).toBe(`${2000 - 28}px`);
  });

  it("puts the page back when it leaves, so nothing stays hidden", () => {
    StoryMotion();
    expect(html.classList.has("story-js")).toBe(true);
    page.cleanup!();
    expect(html.classList.has("story-js")).toBe(false);
    expect(plane.style.top).toBeUndefined();
    expect(page.listeners.size).toBe(0);
    expect(page.observed).toHaveLength(0);
  });
});
