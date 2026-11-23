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

export type ParsedRate = { ok: true; rate: string } | { ok: false; error: string };

// Turns typed text such as "435", "2.65" or "1,234.5" into a clean rate string: no commas,
// no leading zeros, no trailing fraction zeros. Up to 7 whole digits and 6 decimals, above zero.
export function parseRate(raw: string): ParsedRate {
  const badFormat = { ok: false, error: "Enter a rate, like 435." } as const;
  const match = /^([\d,]*)(?:\.(\d*))?$/.exec(raw.trim());
  if (!match) return badFormat;
  const groupedWhole = match[1] ?? "";
  if (groupedWhole.includes(",") && !/^[1-9]\d{0,2}(,\d{3})+$/.test(groupedWhole)) return badFormat;
  const whole = groupedWhole.replace(/,/g, "").replace(/^0+/, "");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (whole.length > 7) return { ok: false, error: "That rate is too large." };
  if (fraction.length > 6 || (whole === "" && fraction === "")) return badFormat;
  return { ok: true, rate: `${whole || "0"}${fraction ? `.${fraction}` : ""}` };
}

// Splits a clean rate string into a whole number and its decimal places: "2.65" -> 265n, 2.
function rateParts(rate: string): { int: bigint; places: number } {
  const [whole = "0", fraction = ""] = rate.split(".");
  return { int: BigInt(whole + fraction), places: fraction.length };
}

// Round-half-up integer division for positive BigInts.
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (BigInt(2) * numerator + denominator) / (BigInt(2) * denominator);
}

// Converts `original` (minor units of `from`) into minor units of `to` at "1 `to` = rate `from`",
// e.g. 870000 dong at "435" -> 200000 centavos. Null when the result is under 1 or over the
// largest amount parseAmount accepts.
export function convertByRate(args: {
  original: number;
  from: string;
  to: string;
  rate: string;
}): number | null {
  const { int, places } = rateParts(args.rate);
  if (int === BigInt(0)) return null;
  const result = divRound(
    BigInt(args.original) * BigInt(10) ** BigInt(minorDigits(args.to) + places),
    BigInt(10) ** BigInt(minorDigits(args.from)) * int,
  );
  if (result < BigInt(1) || result > BigInt(MAX_MAJOR_UNITS) * BigInt(10) ** BigInt(minorDigits(args.to))) {
    return null;
  }
  return Number(result);
}

// The rate a card charge implies ("1 `to` = N `from`"), to 2 decimals, half up: 3,200,000 dong
// charged as 7,412.60 pesos -> "431.70". For display only.
export function effectiveRateText(args: {
  original: number;
  from: string;
  main: number;
  to: string;
}): string {
  const hundredths = divRound(
    BigInt(args.original) * BigInt(10) ** BigInt(minorDigits(args.to)) * BigInt(100),
    BigInt(args.main) * BigInt(10) ** BigInt(minorDigits(args.from)),
  );
  const text = String(hundredths).padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}

// Splits `total` in proportion to `weights` (largest remainder). Shares always add up to
// `total`, a zero weight gets 0, and ties go to the payer first, then list order, so equal
// weights give the same result as splitEqually.
export function allocateLike(total: number, weights: Share[], payerId: string): Share[] {
  const sum = weights.reduce((acc, w) => acc + BigInt(w.amount), BigInt(0));
  if (sum === BigInt(0)) return weights.map(({ spotId }) => ({ spotId, amount: 0 }));
  const rows = weights.map((w, index) => {
    const product = BigInt(total) * BigInt(w.amount);
    return { spotId: w.spotId, index, floor: product / sum, rem: product % sum };
  });
  let left = total - rows.reduce((acc, r) => acc + Number(r.floor), 0);
  const rank = (spotId: string, index: number) => (spotId === payerId ? -1 : index);
  const order = [...rows].sort(
    (a, b) => (a.rem === b.rem ? 0 : a.rem > b.rem ? -1 : 1) || rank(a.spotId, a.index) - rank(b.spotId, b.index),
  );
  const bonus = new Set<number>();
  for (const row of order) {
    if (left-- <= 0) break;
    bonus.add(row.index);
  }
  return rows.map((r) => ({ spotId: r.spotId, amount: Number(r.floor) + (bonus.has(r.index) ? 1 : 0) }));
}
