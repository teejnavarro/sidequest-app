// Money helpers. An amount is a whole number of minor units (centavos for PHP, whole dong
// for VND), so the computer never holds a decimal like 0.1 + 0.2. Parsing and splitting use
// whole-number arithmetic only. Pure functions: safe on the client and the server.

const MAX_MAJOR_UNITS = 1_000_000_000;

// How many decimals the currency uses (PHP 2, VND 0, JPY 0, KRW 0). IDR is forced to 0:
// the standard says 2, but no one pays in sen.
export function minorDigits(currency: string): number {
  if (currency === "IDR") return 0;
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export type ParsedAmount = { ok: true; minor: number } | { ok: false; error: string };

// Turns typed text such as "1,250.50" into minor units, using only string steps.
export function parseAmount(raw: string, currency: string): ParsedAmount {
  const digits = minorDigits(currency);
  const example = digits === 0 ? "1,250" : "1,250.50";
  const badFormat = { ok: false, error: `Enter an amount, like ${example}.` } as const;

  // Commas are allowed only as thousands separators in the whole part: "1,250", never "12,50".
  // Spaces are trimmed at the ends only; a space inside the amount is refused.
  const match = /^([\d,]*)(?:\.(\d*))?$/.exec(raw.trim());
  if (!match) return badFormat;
  const groupedWhole = match[1] ?? "";
  if (groupedWhole.includes(",") && !/^[1-9]\d{0,2}(,\d{3})+$/.test(groupedWhole)) return badFormat;
  const typedWhole = groupedWhole.replace(/,/g, "");
  const fraction = match[2] ?? "";
  if (typedWhole === "" && fraction === "") return badFormat;
  if (fraction.length > digits) return badFormat;

  // More than ten digits is always over the limit, and keeps the number below 2^53.
  const whole = typedWhole.replace(/^0+/, "");
  if (whole.length > 10) return { ok: false, error: "That's too large." };
  const minor = Number(whole + fraction.padEnd(digits, "0"));
  if (minor === 0) return { ok: false, error: "Enter an amount above zero." };
  if (minor > MAX_MAJOR_UNITS * 10 ** digits) return { ok: false, error: "That's too large." };
  return { ok: true, minor };
}

// The amount as plain text for a form box, with the currency's decimals and no commas:
// "1250.50" or "250000".
export function amountText(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const text = String(minor).padStart(digits + 1, "0");
  return digits === 0 ? text : `${text.slice(0, -digits)}.${text.slice(-digits)}`;
}

// "₱1,000.00" or "₫250,000", with the currency's own decimals.
export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const decimal = amountText(minor, currency);
  try {
    // Intl accepts a decimal string and keeps every digit exact; the types only list numbers.
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(decimal as unknown as number);
  } catch {
    return `${decimal} ${currency}`;
  }
}

// What one minor unit is called, for "takes the extra centavo".
const UNIT_NAMES: Record<string, string> = {
  PHP: "centavo",
  VND: "dong",
  JPY: "yen",
  KRW: "won",
  IDR: "rupiah",
};
export function minorUnitName(currency: string): string {
  return UNIT_NAMES[currency] ?? (minorDigits(currency) === 2 ? "cent" : "unit");
}

export type Share = { spotId: string; amount: number };

// Splits `total` equally. Any leftover minor units go one each to the payer first (if the
// payer is sharing), then to the others in the order given. Shares always add up to `total`.
export function splitEqually(total: number, spotIds: string[], payerId: string): Share[] {
  const count = spotIds.length;
  if (count === 0) return [];
  const extra = total % count;
  const base = (total - extra) / count;
  const order = spotIds.includes(payerId)
    ? [payerId, ...spotIds.filter((id) => id !== payerId)]
    : spotIds;
  const gets = new Set(order.slice(0, extra));
  return spotIds.map((spotId) => ({ spotId, amount: base + (gets.has(spotId) ? 1 : 0) }));
}

export type OwnAmount = { spotId: string; own: number }; // own > 0

// An uneven split: each person's share is what they had (their own amount, 0 if none) plus
// an equal part of what is left over, split with splitEqually. Own amounts for people not in
// `sharedBy` are ignored. Null when the own amounts add up to more than `total`.
export function splitByItems(
  total: number,
  sharedBy: string[],
  own: OwnAmount[],
  payerId: string,
): { shares: (Share & { own: number; equalPart: number })[]; rest: number } | null {
  const ownBySpot = new Map(
    own.filter((o) => sharedBy.includes(o.spotId)).map((o) => [o.spotId, o.own]),
  );
  let rest = total;
  for (const amount of ownBySpot.values()) rest -= amount;
  if (rest < 0) return null;
  const equal = splitEqually(rest, sharedBy, payerId);
  return {
    rest,
    shares: equal.map(({ spotId, amount }) => {
      const mine = ownBySpot.get(spotId) ?? 0;
      return { spotId, amount: mine + amount, own: mine, equalPart: amount };
    }),
  };
}
