import { describe, expect, it } from "vitest";
import type { CostsExport, ExportCost, ExportPerson } from "@/lib/costs";
import { buildCostsCsv, csvFileName, csvPeopleHeadings } from "@/lib/costs-csv";

const person = (spotId: string, name: string, extra: Partial<ExportPerson> = {}): ExportPerson => ({
  spotId,
  name,
  isGuest: false,
  hasLeft: false,
  ...extra,
});

const cost = (over: Partial<ExportCost>): ExportCost => ({
  id: "c",
  spentOn: "2027-05-08",
  description: "x",
  category: null,
  amount: 100,
  original: null,
  paidBy: "a",
  shares: {},
  ...over,
});

const people = [
  person("a", "Maria Cruz"),
  person("b", "Bea Lim"),
  person("c", "Jun Tan"),
  person("d", "Dana Reyes", { isGuest: true }),
];

// The Lavish example: three costs, each person's share in centavos.
const data: CostsExport = {
  tripName: "Saigon barkada",
  currency: "PHP",
  people,
  costs: [
    cost({
      id: "1",
      description: "Dinner at Bún Chả",
      category: "food",
      amount: 200000,
      original: { amount: 870000, currency: "VND", rate: "435" },
      paidBy: "c",
      shares: { a: 84483, b: 61494, c: 15517, d: 38506 },
    }),
    cost({
      id: "2",
      description: "Hotel, 2 nights",
      category: "lodging",
      amount: 741260,
      original: { amount: 3200000, currency: "VND", rate: null },
      paidBy: "b",
      shares: { a: 185315, b: 185315, c: 185315, d: 185315 },
    }),
    cost({
      id: "3",
      spentOn: "2027-05-07",
      description: "Ferry tickets",
      category: "transport",
      amount: 72000,
      paidBy: "a",
      shares: { a: 18000, b: 18000, c: 18000, d: 18000 },
    }),
  ],
};

describe("buildCostsCsv", () => {
  const csv = buildCostsCsv(data);
  const lines = csv.slice(1).split("\r\n");

  it("starts with the BOM and uses CRLF line ends", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("has the headings, rows and TOTAL of the approved example", () => {
    expect(lines[0]).toBe("Date,What,Category,Amount,Currency,Rate (₱1 =),Amount in PHP,Paid by,Maria,Bea,Jun,Dana (guest)");
    expect(lines[1]).toBe("2027-05-08,Dinner at Bún Chả,Food,870000,VND,435,2000.00,Jun,844.83,614.94,155.17,385.06");
    expect(lines[2]).toBe('2027-05-08,"Hotel, 2 nights",Lodging,3200000,VND,,7412.60,Bea,1853.15,1853.15,1853.15,1853.15');
    expect(lines[3]).toBe("2027-05-07,Ferry tickets,Transport,720.00,PHP,,720.00,Maria,180.00,180.00,180.00,180.00");
    expect(lines[4]).toBe("TOTAL,,,,,,10132.60,,2877.98,2648.09,2188.32,2418.21");
    expect(lines[5]).toBe("");
  });

  it("shows 0.00 for people outside a cost and a blank category as empty", () => {
    const out = buildCostsCsv({ ...data, costs: [cost({ amount: 500, shares: { a: 500 } })] }).slice(1);
    expect(out.split("\r\n")[1]).toBe("2027-05-08,x,,5.00,PHP,,5.00,Maria,5.00,0.00,0.00,0.00");
  });

  it("quotes commas, quotes, newlines and edge spaces", () => {
    const out = buildCostsCsv({ ...data, costs: [cost({ description: 'Say "hi",\nbye' })] });
    expect(out).toContain('"Say ""hi"",\nbye"');
    expect(buildCostsCsv({ ...data, costs: [cost({ description: " padded" })] })).toContain('," padded",');
  });

  it("guards text cells that start like a formula, but not numbers", () => {
    const out = buildCostsCsv({
      ...data,
      costs: [cost({ description: "=SUM(A1)", category: "+x", amount: 100, shares: { a: 100 } })],
    });
    expect(out).toContain("'=SUM(A1)");
    expect(out).toContain("'+x");
    expect(out).not.toContain("'1.00");
    expect(buildCostsCsv({ ...data, people: [person("a", "=Evil Name")], costs: [] })).toContain("'=Evil");
  });
});

describe("csvPeopleHeadings", () => {
  it("uses first names", () => {
    expect(csvPeopleHeadings([person("a", "Maria Cruz"), person("b", "Bea Lim")])).toEqual(["Maria", "Bea"]);
  });

  it("adds the last initial on a clash, then 2 when still clashing", () => {
    expect(csvPeopleHeadings([person("a", "Ana Reyes"), person("b", "Ana Lim")])).toEqual(["Ana R.", "Ana L."]);
    expect(csvPeopleHeadings([person("a", "Ana Reyes"), person("b", "Ana Ramos"), person("c", "Ana")])).toEqual([
      "Ana R.",
      "Ana R. 2",
      "Ana",
    ]);
    expect(csvPeopleHeadings([person("a", "Ana"), person("b", "Ana")])).toEqual(["Ana", "Ana 2"]);
  });

  it("adds guest and left suffixes", () => {
    expect(
      csvPeopleHeadings([person("a", "Dana Reyes", { isGuest: true }), person("b", "Jun Tan", { hasLeft: true })]),
    ).toEqual(["Dana (guest)", "Jun (left the trip)"]);
  });
});

describe("csvFileName", () => {
  it("makes a plain ascii name", () => {
    expect(csvFileName("Saigon barkada")).toBe("saigon-barkada-costs.csv");
    expect(csvFileName("Bún Chả: Hà Nội!")).toBe("bun-cha-ha-noi-costs.csv");
  });
  it("falls back and truncates", () => {
    expect(csvFileName("日本旅行")).toBe("trip-costs.csv");
    expect(csvFileName("a".repeat(60))).toBe(`${"a".repeat(40)}-costs.csv`);
  });
});
