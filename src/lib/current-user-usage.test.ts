// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Pages and layouts use the cached "ForPage" check. Server Actions and route
// handlers use the fresh one, so Better Auth can renew the sign-in cookie.

const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const files = ["src/app", "src/lib", "src/components"]
  .flatMap((dir) => walk(join(root, dir)))
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .filter((path) => /\.tsx?$/.test(path))
  .filter((path) => !/\.test\./.test(path) && path !== "src/lib/current-user.ts");

// Names imported from "@/lib/current-user" across every import line, or null when
// the file doesn't import it. Type-only imports are skipped (they run no lookup);
// a namespace import (`* as x`) is recorded as "*" so the test can ask for names.
function importedNames(source: string): string[] | null {
  const names: string[] = [];
  let found = false;
  // The clause can't run past another `import` or `from`, so each match is one statement.
  const pattern = /\bimport\s+(type\s+)?((?:(?!\bimport\b|\bfrom\b)[\s\S])*?)\s*from\s*["']@\/lib\/current-user["']/g;
  for (const [, typeOnly, clause] of source.matchAll(pattern)) {
    if (typeOnly) continue;
    found = true;
    if (/\*\s*as\s+/.test(clause)) names.push("*");
    for (const [, inner] of clause.matchAll(/\{([^}]*)\}/g)) {
      names.push(
        ...inner
          .split(",")
          .map((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
          .filter(Boolean),
      );
    }
  }
  return found ? names : null;
}

const fresh = ["getOptionalUser", "getCurrentUser"];
const forPage = ["getOptionalUserForPage", "getCurrentUserForPage"];

describe("importedNames", () => {
  it("reads every import line, not just the first", () => {
    const source = [
      'import { getOptionalUserForPage } from "@/lib/current-user";',
      'import { notFound } from "next/navigation";',
      'import { getCurrentUser as check } from "@/lib/current-user";',
    ].join("\n");
    expect(importedNames(source)).toEqual(["getOptionalUserForPage", "getCurrentUser"]);
  });

  it("reads a multi-line import", () => {
    const source = 'import {\n  getCurrentUser,\n  type CurrentUser,\n} from "@/lib/current-user";';
    expect(importedNames(source)).toEqual(["getCurrentUser", "CurrentUser"]);
  });

  it("does not take names from a neighbouring import", () => {
    const source = 'import { getCurrentUser } from "@/lib/other";\nimport { redirect } from "next/navigation";';
    expect(importedNames(source)).toBeNull();
  });

  it("marks a namespace import so it can be flagged", () => {
    expect(importedNames('import * as cu from "@/lib/current-user";')).toEqual(["*"]);
  });

  it("skips type-only imports", () => {
    expect(importedNames('import type { CurrentUser } from "@/lib/current-user";')).toBeNull();
  });
});

describe("current-user usage", () => {
  const users = files.flatMap((path) => {
    const source = readFileSync(join(root, path), "utf8");
    const names = importedNames(source);
    return names ? [{ path, names, source }] : [];
  });

  it("finds pages and routes to check", () => {
    expect(users.some((u) => /\/(page|layout)\.tsx$/.test(u.path))).toBe(true);
    expect(users.some((u) => /\/route\.ts$/.test(u.path))).toBe(true);
  });

  it("walks src/components too", () => {
    expect(files.some((path) => path.startsWith("src/components/"))).toBe(true);
  });

  for (const { path, names, source } of users) {
    it(`${path} uses the right version`, () => {
      expect(names, `${path} imports current-user with "* as": import the version it needs by name so this test can check it.`).not.toContain("*");
      const isPage = /\/(page|layout)\.tsx$/.test(path);
      const isFresh =
        /\/(route|actions)\.ts$/.test(path) || /^\s*["']use server["']/m.test(source.slice(0, 200));
      if (isPage) {
        const bad = names.filter((n) => fresh.includes(n));
        expect(bad, `${path} is a page or layout: use ${bad.map((n) => n + "ForPage").join(", ")} so the cached check is used.`).toEqual([]);
      } else if (isFresh) {
        const bad = names.filter((n) => forPage.includes(n));
        expect(bad, `${path} is an action or route: use ${bad.map((n) => n.replace("ForPage", "")).join(", ")} (fresh) so the sign-in cookie can be renewed.`).toEqual([]);
      } else {
        expect.fail(`${path} imports current-user but is not a page, layout, route or action. Decide which version it needs (cached ForPage for pages, fresh for actions and routes) and extend this test.`);
      }
    });
  }
});
