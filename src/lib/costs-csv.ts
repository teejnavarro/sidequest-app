// The spreadsheet download for a trip's costs. Pure text building, no database: the route
// hands in the rows from listCostsForExport and sends back what this returns.
import type { CostsExport, ExportPerson } from "@/lib/costs";
import { COST_CATEGORIES } from "@/lib/cost-options";
import { firstNameOf } from "@/lib/display-name";
import { amountText, currencySymbol } from "@/lib/money";

// An invisible marker at the very start so Excel reads accents (Bún Chả) as UTF-8.
const BOM = "﻿";

// A text cell that starts like a formula would run in a spreadsheet. A leading ' makes it text.
function guard(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

// Wraps a field in quotes when it holds a comma, quote, line break or edge space.
function quote(field: string): string {
  return /[,"\r\n]|^\s|\s$/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

const textCell = (text: string) => quote(guard(text));

// One column heading per person: first name; on a clash add the last initial ("Ana R."), then
// " 2", " 3" in list order for what still clashes; then (guest) or (left the trip).
export function csvPeopleHeadings(people: ExportPerson[]): string[] {
  const first = people.map((person) => firstNameOf(person.name));
  const count = new Map<string, number>();
  for (const name of first) count.set(name.toLowerCase(), (count.get(name.toLowerCase()) ?? 0) + 1);

  const withInitial = people.map((person, index) => {
    if ((count.get(first[index]!.toLowerCase()) ?? 0) < 2) return first[index]!;
    const last = person.name.trim().split(/\s+/).slice(1).pop();
    return last ? `${first[index]} ${last.charAt(0).toUpperCase()}.` : first[index]!;
  });

  const seen = new Map<string, number>();
  return withInitial.map((label, index) => {
    const key = label.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const clashes = withInitial.filter((other) => other.toLowerCase() === key).length > 1;
    const numbered = clashes && n > 1 ? `${label} ${n}` : label;
    const person = people[index]!;
    if (person.isGuest) return `${numbered} (guest)`;
    if (person.hasLeft) return `${numbered} (left the trip)`;
    return numbered;
  });
}

// "saigon-barkada-costs.csv": plain letters, digits and dashes only.
export function csvFileName(tripName: string): string {
  const slug = tripName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${slug || "trip"}-costs.csv`;
}


export function buildCostsCsv(data: CostsExport): string {
  const { currency, people, costs } = data;
  const headings = csvPeopleHeadings(people);
  const labelOf = new Map(people.map((person, index) => [person.spotId, headings[index]!]));

  // Each cell says whether it is free text (guarded against formulas) or a number or date.
  type Cell = { text: string; free?: boolean };
  const num = (text: string): Cell => ({ text });
  const free = (text: string): Cell => ({ text, free: true });

  const lines: Cell[][] = [
    [
      num("Date"),
      num("What"),
      num("Category"),
      num("Amount"),
      num("Currency"),
      num(`Rate (${currencySymbol(currency)}1 =)`),
      num(`Amount in ${currency}`),
      num("Paid by"),
      ...headings.map(free),
    ],
  ];

  let total = 0;
  const personTotals = people.map(() => 0);
  for (const item of costs) {
    const shown = item.original
      ? { amount: amountText(item.original.amount, item.original.currency), currency: item.original.currency }
      : { amount: amountText(item.amount, currency), currency };
    const category = COST_CATEGORIES.find((option) => option.value === item.category)?.label ?? item.category ?? "";
    total += item.amount;
    const shares = people.map((person, index) => {
      const share = item.shares[person.spotId] ?? 0;
      personTotals[index]! += share;
      return num(amountText(share, currency));
    });
    lines.push([
      num(item.spentOn),
      free(item.description),
      free(category),
      num(shown.amount),
      num(shown.currency),
      num(item.original?.rate ?? ""),
      num(amountText(item.amount, currency)),
      free(labelOf.get(item.paidBy) ?? ""),
      ...shares,
    ]);
  }

  lines.push([
    num("TOTAL"),
    num(""),
    num(""),
    num(""),
    num(""),
    num(""),
    num(amountText(total, currency)),
    num(""),
    ...personTotals.map((sum) => num(amountText(sum, currency))),
  ]);

  const text = lines
    .map((line) => line.map((cell) => (cell.free ? textCell(cell.text) : quote(cell.text))).join(","))
    .join("\r\n");
  return `${BOM}${text}\r\n`;
}
