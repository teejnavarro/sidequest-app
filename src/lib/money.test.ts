import { describe, expect, it } from "vitest";
import {
  allocateLike,
  amountText,
  convertByRate,
  effectiveRateText,
  formatMoney,
  minorDigits,
  parseAmount,
  parseRate,
  splitByItems,
  splitEqually,
} from "./money";

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

describe("splitByItems", () => {
  const ids = ["you", "bea", "jun", "dana"];

  it("matches the Lavish example", () => {
    const result = splitByItems(
      186000,
      ids,
      [
        { spotId: "you", own: 70000 },
        { spotId: "bea", own: 50000 },
        { spotId: "dana", own: 30000 },
      ],
      "jun",
    );
    expect(result?.shares.map((s) => s.amount)).toEqual([79000, 59000, 9000, 39000]);
    expect(result?.rest).toBe(36000);
  });

  it("refuses own amounts over the total", () => {
    expect(splitByItems(1000, ids, [{ spotId: "you", own: 1001 }], "you")).toBeNull();
  });

  it("gives rest 0 when own amounts equal the total", () => {
    const result = splitByItems(1000, ["a", "b"], [{ spotId: "a", own: 600 }, { spotId: "b", own: 400 }], "a");
    expect(result?.rest).toBe(0);
    expect(result?.shares.map((s) => s.amount)).toEqual([600, 400]);
  });

  it("gives the payer the extra unit of an odd rest first", () => {
    const result = splitByItems(1002, ["a", "b", "c"], [{ spotId: "a", own: 1 }], "c");
    expect(result?.rest).toBe(1001);
    expect(result?.shares.map((s) => s.equalPart)).toEqual([334, 333, 334]);
    expect(result?.shares.map((s) => s.amount)).toEqual([335, 333, 334]);
  });

  it("ignores own amounts for people not sharing", () => {
    const result = splitByItems(900, ["a", "b"], [{ spotId: "z", own: 500 }], "a");
    expect(result?.rest).toBe(900);
  });

  it("always adds up to the total, each share own + equal part", () => {
    let seed = 7;
    const random = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    };
    for (let run = 0; run < 500; run++) {
      const count = 1 + random(6);
      const spots = Array.from({ length: count }, (_, i) => `s${i}`);
      const total = 1 + random(100000);
      const own = spots
        .filter(() => random(2) === 0)
        .map((spotId) => ({ spotId, own: 1 + random(Math.max(1, Math.floor(total / count))) }));
      const result = splitByItems(total, spots, own, spots[random(count)]!);
      if (!result) continue;
      expect(result.shares.reduce((s, x) => s + x.amount, 0)).toBe(total);
      for (const share of result.shares) expect(share.amount).toBe(share.own + share.equalPart);
    }
  });
});

describe("parseRate", () => {
  const rate = (raw: string) => {
    const result = parseRate(raw);
    return result.ok ? result.rate : result.error;
  };

  it("normalizes what was typed", () => {
    expect(rate("435")).toBe("435");
    expect(rate("0435")).toBe("435");
    expect(rate("435.50")).toBe("435.5");
    expect(rate("435.0")).toBe("435");
    expect(rate("1,234.5")).toBe("1234.5");
    expect(rate(" 2.65 ")).toBe("2.65");
    expect(rate("0.0435")).toBe("0.0435");
    expect(rate(".5")).toBe("0.5");
  });

  it("refuses bad text and zero", () => {
    for (const raw of ["", "abc", "12,34", "0", "0.000", "1 000", "-5", "."]) {
      expect(rate(raw)).toBe("Enter a rate, like 435.");
    }
  });

  it("enforces 7 whole digits and 6 decimals", () => {
    expect(rate("9999999")).toBe("9999999");
    expect(rate("10000000")).toBe("That rate is too large.");
    expect(rate("1.123456")).toBe("1.123456");
    expect(rate("1.1234567")).toBe("Enter a rate, like 435.");
    expect(rate("1.1234560")).toBe("1.123456");
  });
});

describe("convertByRate", () => {
  const convert = (original: number, from: string, to: string, rate: string) =>
    convertByRate({ original, from, to, rate });

  it("converts dong to pesos", () => {
    expect(convert(870000, "VND", "PHP", "435")).toBe(200000);
    expect(convert(250000, "VND", "PHP", "435")).toBe(57471);
  });

  it("rounds half up", () => {
    // 1 / 2 pesos' worth: 5 dong at 200 = 0.025 pesos = 2.5 centavos -> 3
    expect(convert(5, "VND", "PHP", "200")).toBe(3);
    expect(convert(7, "VND", "PHP", "200")).toBe(4); // 3.5 centavos
  });

  it("uses the target's digits (JPY has none)", () => {
    expect(convert(10000, "PHP", "JPY", "0.4")).toBe(250);
    expect(convert(10000, "PHP", "JPY", "2.65")).toBe(38);
  });

  it("handles decimal rates", () => {
    expect(convert(265, "USD", "PHP", "2.65")).toBe(100);
    expect(convert(4350, "PHP", "VND", "0.0435")).toBe(1000);
  });

  it("returns null when too small or too large", () => {
    expect(convert(1, "VND", "PHP", "1000")).toBe(null);
    expect(convert(1_000_000_000_00, "VND", "PHP", "0.0001")).toBe(null);
  });
});

describe("effectiveRateText", () => {
  it("shows the rate a card charge implies", () => {
    expect(effectiveRateText({ original: 3200000, from: "VND", main: 741260, to: "PHP" })).toBe(
      "431.70",
    );
    expect(effectiveRateText({ original: 870000, from: "VND", main: 200000, to: "PHP" })).toBe(
      "435.00",
    );
  });
});

describe("allocateLike", () => {
  const w = (...amounts: number[]) => amounts.map((amount, i) => ({ spotId: `s${i}`, amount }));
  const sum = (shares: { amount: number }[]) => shares.reduce((s, x) => s + x.amount, 0);

  it("gives the worked example", () => {
    const shares = allocateLike(200000, w(367500, 267500, 67500, 167500), "s0");
    expect(shares.map((s) => s.amount)).toEqual([84483, 61494, 15517, 38506]);
  });

  it("always sums exactly", () => {
    for (const total of [1, 7, 99999, 200001]) {
      expect(sum(allocateLike(total, w(3, 5, 11, 1), "s2"))).toBe(total);
    }
  });

  it("matches splitEqually for equal weights, payer first", () => {
    for (const payer of ["s0", "s1", "s2", "other"]) {
      const ids = ["s0", "s1", "s2"];
      const expected = splitEqually(100, ids, payer);
      expect(allocateLike(100, w(50, 50, 50), payer)).toEqual(expected);
    }
  });

  it("gives a zero weight nothing", () => {
    const shares = allocateLike(100, w(0, 1, 2), "s0");
    expect(shares[0]?.amount).toBe(0);
    expect(sum(shares)).toBe(100);
  });
});
