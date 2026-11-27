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

const files = [...walk(join(root, "src/app")), ...walk(join(root, "src/lib"))]
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .filter((path) => /\.tsx?$/.test(path))
  .filter((path) => !/\.test\./.test(path) && path !== "src/lib/current-user.ts");

// Names imported from "@/lib/current-user", or null when the file doesn't import it.
function importedNames(path: string): { names: string[]; source: string } | null {
  const source = readFileSync(join(root, path), "utf8");
  const match = source.match(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/current-user["']/);
  if (!match) return null;
  const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  return { names, source };
}

const fresh = ["getOptionalUser", "getCurrentUser"];
const forPage = ["getOptionalUserForPage", "getCurrentUserForPage"];

describe("current-user usage", () => {
  const users = files
    .map((path) => ({ path, found: importedNames(path) }))
    .filter((u): u is { path: string; found: { names: string[]; source: string } } => u.found !== null);

  it("finds pages and routes to check", () => {
    expect(users.some((u) => /\/(page|layout)\.tsx$/.test(u.path))).toBe(true);
    expect(users.some((u) => /\/route\.ts$/.test(u.path))).toBe(true);
  });

  for (const { path, found } of users) {
    it(`${path} uses the right version`, () => {
      const isPage = /\/(page|layout)\.tsx$/.test(path);
      const isFresh =
        /\/(route|actions)\.ts$/.test(path) || /^\s*["']use server["']/m.test(found.source.slice(0, 200));
      if (isPage) {
        const bad = found.names.filter((n) => fresh.includes(n));
        expect(bad, `${path} is a page or layout: use ${bad.map((n) => n + "ForPage").join(", ")} so the cached check is used.`).toEqual([]);
      } else if (isFresh) {
        const bad = found.names.filter((n) => forPage.includes(n));
        expect(bad, `${path} is an action or route: use ${bad.map((n) => n.replace("ForPage", "")).join(", ")} (fresh) so the sign-in cookie can be renewed.`).toEqual([]);
      } else {
        expect.fail(`${path} imports current-user but is not a page, layout, route or action. Decide which version it needs (cached ForPage for pages, fresh for actions and routes) and extend this test.`);
      }
    });
  }
});
