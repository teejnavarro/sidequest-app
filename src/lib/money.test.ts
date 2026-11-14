import { describe, expect, it } from "vitest";
import { amountText, formatMoney, minorDigits, parseAmount, splitEqually } from "./money";

describe("minorDigits", () => {
  it("knows each currency's decimals", () => {
    expect(minorDigits("PHP")).toBe(2);
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("VND")).toBe(0);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KRW")).toBe(0);
    expect(minorDigits("IDR")).toBe(0);
  });
});

describe("parseAmount", () => {
  const minor = (raw: string, currency = "PHP") => {
    const result = parseAmount(raw, currency);
    return result.ok ? result.minor : result.error;
  };

  it("reads pesos into centavos", () => {
    expect(minor("1,250.50")).toBe(125050);
    expect(minor("1250")).toBe(125000);
    expect(minor(" 1250 ")).toBe(125000);
    expect(minor("0.05")).toBe(5);
    expect(minor(".5")).toBe(50);
    expect(minor("12.")).toBe(1200);
    expect(minor("0001.10")).toBe(110);
  });

  it("is exact where floating point is not", () => {
    expect(minor("0.29")).toBe(29);
    expect(minor("1.15")).toBe(115);
    expect(minor("4.35")).toBe(435);
    expect(minor("1000000000")).toBe(100_000_000_000);
  });

  it("refuses too many decimals", () => {
    expect(minor("1250.505")).toBe("Enter an amount, like 1,250.50.");
  });

  it("refuses nothing, words, signs and zero", () => {
    expect(minor("")).toBe("Enter an amount, like 1,250.50.");
    expect(minor(".")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("abc")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("-5")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("1e3")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("1.2.3")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("0")).toBe("Enter an amount above zero.");
    expect(minor("0.00")).toBe("Enter an amount above zero.");
  });

  it("refuses amounts over 1,000,000,000", () => {
    expect(minor("1000000001")).toBe("That's too large.");
    expect(minor("1000000000.01")).toBe("That's too large.");
    expect(minor("99999999999999999999")).toBe("That's too large.");
  });

  it("works in whole units for zero-decimal currencies", () => {
    expect(minor("250,000", "VND")).toBe(250000);
    expect(minor("250.5", "VND")).toBe("Enter an amount, like 1,250.");
    expect(minor("250.0", "VND")).toBe("Enter an amount, like 1,250.");
    expect(minor("250.", "VND")).toBe(250);
    expect(minor("0", "VND")).toBe("Enter an amount above zero.");
    expect(minor("1000000001", "VND")).toBe("That's too large.");
  });

  it("takes commas only as thousands separators", () => {
    expect(minor("1,250")).toBe(125000);
    expect(minor("1,250.50")).toBe(125050);
    expect(minor("1,000,000")).toBe(100_000_000);
    expect(minor("1250.50")).toBe(125050);
    expect(minor(" 1,250 ")).toBe(125000);
  });

  it("refuses misplaced commas", () => {
    for (const raw of ["1250,50", "12,50", "1,25", "1,2345", ",500", "1,,250", "1,250,", "1.250,50"]) {
      expect(minor(raw)).toBe("Enter an amount, like 1,250.50.");
    }
  });

  it("refuses a comma group that starts with zero", () => {
    for (const raw of ["0,500", "001,250", "00,500"]) {
      expect(minor(raw)).toBe("Enter an amount, like 1,250.50.");
      expect(minor(raw, "VND")).toBe("Enter an amount, like 1,250.");
    }
  });

  it("refuses a space inside the amount", () => {
    for (const raw of ["12 50", "1 250", "1, 250", "1,250 .50"]) {
      expect(minor(raw)).toBe("Enter an amount, like 1,250.50.");
      expect(minor(raw, "VND")).toBe("Enter an amount, like 1,250.");
    }
  });

  it("trims pasted spaces at the ends but refuses them inside", () => {
    expect(minor(" 1,250\t")).toBe(125000);
    expect(minor("1 250")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("0,000")).toBe("Enter an amount, like 1,250.50.");
  });

  it("takes and refuses the same commas for zero-decimal currencies", () => {
    expect(minor("1,250", "VND")).toBe(1250);
    expect(minor(" 1,250 ", "VND")).toBe(1250);
    for (const raw of ["1250,50", "12,50", "1,25", "1,2345", ",500", "1,,250", "1,250,", "1.250,50"]) {
      expect(minor(raw, "VND")).toBe("Enter an amount, like 1,250.");
    }
  });

  it("refuses digits from other scripts instead of misreading them", () => {
    expect(minor("１２３")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("١٢٣")).toBe("Enter an amount, like 1,250.50.");
  });

  it("takes the exact limit and refuses one centavo more", () => {
    expect(minor("1,000,000,000.00")).toBe(100_000_000_000);
    expect(minor("999,999,999.99")).toBe(99_999_999_999);
    expect(minor("1000000000.01")).toBe("That's too large.");
  });

  it("reads a one-digit fraction after grouped thousands", () => {
    expect(minor("1,250.5")).toBe(125050);
    expect(minor("1,250.5", "VND")).toBe("Enter an amount, like 1,250.");
  });

  it("refuses full-width commas and other-script digits around commas", () => {
    expect(minor("1，250")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("１,２５０")).toBe("Enter an amount, like 1,250.50.");
    expect(minor("1,٢٥٠")).toBe("Enter an amount, like 1,250.50.");
  });

  it("applies the limit to grouped amounts", () => {
    expect(minor("1,000,000,001")).toBe("That's too large.");
    expect(minor("10,000,000,000")).toBe("That's too large.");
    expect(minor("1,000,000,000", "VND")).toBe(1_000_000_000);
    expect(minor("1,000,000,001", "VND")).toBe("That's too large.");
  });

  it("treats a plain zero as zero", () => {
    expect(minor("0")).toBe("Enter an amount above zero.");
    expect(minor("0.00")).toBe("Enter an amount above zero.");
  });
});

describe("amountText", () => {
  it("writes minor units back as plain form text", () => {
    expect(amountText(125050, "PHP")).toBe("1250.50");
    expect(amountText(5, "PHP")).toBe("0.05");
    expect(amountText(250000, "VND")).toBe("250000");
    expect(amountText(5, "VND")).toBe("5");
  });

  it("round-trips through parseAmount", () => {
    for (const minor of [1, 99, 100, 125050, 100_000_000_000]) {
      expect(parseAmount(amountText(minor, "PHP"), "PHP")).toEqual({ ok: true, minor });
    }
  });
});

describe("formatMoney", () => {
  it("shows pesos with centavos", () => {
    expect(formatMoney(100000, "PHP")).toBe("₱1,000.00");
    expect(formatMoney(33334, "PHP")).toBe("₱333.34");
    expect(formatMoney(5, "PHP")).toBe("₱0.05");
    expect(formatMoney(100_000_000_000, "PHP")).toBe("₱1,000,000,000.00");
  });

  it("shows zero-decimal currencies without decimals", () => {
    expect(formatMoney(250000, "VND")).toBe("₫250,000");
    expect(formatMoney(5, "VND")).toBe("₫5");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(formatMoney(1500, "KRW")).toBe("₩1,500");
    // Intl puts a non-breaking space after "Rp".
    expect(formatMoney(250000, "IDR")).toMatch(/^Rp\s250,000$/);
  });

  it("keeps every digit of the largest amount", () => {
    expect(formatMoney(99_999_999_999, "PHP")).toBe("₱999,999,999.99");
    expect(formatMoney(1, "PHP")).toBe("₱0.01");
  });
});

describe("splitEqually", () => {
  const amounts = (shares: { amount: number }[]) => shares.map((s) => s.amount);

  it("gives the payer the extra centavo when the payer shares", () => {
    expect(amounts(splitEqually(100000, ["a", "b", "c"], "a"))).toEqual([33334, 33333, 33333]);
    const last = splitEqually(100000, ["a", "b", "c"], "c");
    expect(last.map((s) => s.spotId)).toEqual(["a", "b", "c"]);
    expect(amounts(last)).toEqual([33333, 33333, 33334]);
  });

  it("gives the first person the extra when the payer is not sharing", () => {
    expect(amounts(splitEqually(100000, ["a", "b", "c"], "z"))).toEqual([33334, 33333, 33333]);
  });

  it("spreads several leftover units, payer first", () => {
    expect(amounts(splitEqually(2, ["a", "b", "c"], "a"))).toEqual([1, 1, 0]);
    expect(amounts(splitEqually(2, ["a", "b", "c"], "c"))).toEqual([1, 0, 1]);
    expect(amounts(splitEqually(5, ["a", "b", "c"], "b"))).toEqual([2, 2, 1]);
    // Payer not sharing: the leftovers go in list order.
    expect(amounts(splitEqually(2, ["a", "b", "c"], "z"))).toEqual([1, 1, 0]);
  });

  it("splits evenly with no leftover", () => {
    expect(amounts(splitEqually(300000, ["a", "b", "c", "d"], "a"))).toEqual([75000, 75000, 75000, 75000]);
    expect(amounts(splitEqually(500, ["a"], "a"))).toEqual([500]);
  });

  it("always adds up to the total", () => {
    for (let total = 1; total <= 200; total++) {
      for (let n = 1; n <= 9; n++) {
        const ids = Array.from({ length: n }, (_, i) => `s${i}`);
        const shares = splitEqually(total, ids, `s${total % n}`);
        expect(shares.reduce((sum, s) => sum + s.amount, 0)).toBe(total);
        expect(Math.max(...amounts(shares)) - Math.min(...amounts(shares))).toBeLessThanOrEqual(1);
      }
    }
    const big = splitEqually(100_000_000_000, ["a", "b", "c"], "a");
    expect(big.reduce((sum, s) => sum + s.amount, 0)).toBe(100_000_000_000);
  });

  it("returns nothing for nobody", () => {
    expect(splitEqually(100, [], "a")).toEqual([]);
  });
});
