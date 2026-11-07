// Types and durations an idea can have, plus two small text helpers. Plain data and plain
// functions: safe on the client and the server. The stored value is the `value` below, so
// labels and icons can change later without touching saved ideas.

export type IdeaTypeOption = {
  value: string;
  label: string;
  // The Phosphor icon for this type, by name. components/idea-type.tsx turns it into an icon.
  icon: "ForkKnife" | "Binoculars" | "Mountains" | "Sparkle" | "ShoppingBag" | "Martini" | "DotsThreeCircle";
};

export const IDEA_TYPES: IdeaTypeOption[] = [
  { value: "food", label: "Food", icon: "ForkKnife" },
  { value: "sightseeing", label: "Sightseeing", icon: "Binoculars" },
  { value: "adventure", label: "Adventure", icon: "Mountains" },
  { value: "experience", label: "Experience", icon: "Sparkle" },
  { value: "shopping", label: "Shopping", icon: "ShoppingBag" },
  { value: "nightlife", label: "Nightlife", icon: "Martini" },
  { value: "other", label: "Other", icon: "DotsThreeCircle" },
];

export type IdeaDurationOption = { value: string; label: string };

export const DURATIONS: IdeaDurationOption[] = [
  { value: "short", label: "1–2 hrs" },
  { value: "half", label: "Half day" },
  { value: "full", label: "Full day" },
];

export function isIdeaType(value: string): boolean {
  return IDEA_TYPES.some((type) => type.value === value);
}

export function isDuration(value: string): boolean {
  return DURATIONS.some((duration) => duration.value === value);
}

export function ideaTypeOf(value: string): IdeaTypeOption {
  return IDEA_TYPES.find((type) => type.value === value) ?? IDEA_TYPES[IDEA_TYPES.length - 1];
}

export function durationLabel(value: string): string {
  return DURATIONS.find((duration) => duration.value === value)?.label ?? value;
}

// A whole amount in the trip's currency, such as "₱120". Money is shown as plain whole
// units here, with the currency's own short symbol.
export function formatCost(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const GOOGLE_HOST = /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
const MAPS_GOOGLE_HOST = /^maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

// The words on a link button: "Open in Google Maps" for the usual Google Maps addresses,
// otherwise "Open link".
export function linkLabel(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Open link";
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const isMaps =
    host === "maps.app.goo.gl" ||
    (host === "goo.gl" && path.startsWith("/maps")) ||
    MAPS_GOOGLE_HOST.test(host) ||
    (GOOGLE_HOST.test(host) && path.startsWith("/maps"));
  return isMaps ? "Open in Google Maps" : "Open link";
}

// The short symbol for a currency, such as "₱" for PHP, to show before a cost box. Falls
// back to the code itself.
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
