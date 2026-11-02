import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/db/auth-schema";

const SAFE_CODE = /^[A-Z0-9_]{1,40}$/;
const SAFE_NAME = /^[A-Za-z]{1,30}Error$/;

// Error names and fixed codes only, following each error's cause. An error's message
// is never used, because a failed database query puts its values there.
function safeErrorLabels(value: unknown): string[] {
  const labels: string[] = [];
  let current = value;
  for (let depth = 0; depth < 5 && typeof current === "object" && current; depth++) {
    const { name, code, digest, cause } = current as Record<string, unknown>;
    if (typeof name === "string" && SAFE_NAME.test(name)) labels.push(name);
    for (const fixed of [code, digest]) {
      if (typeof fixed === "string" && SAFE_CODE.test(fixed)) labels.push(fixed);
    }
    current = cause;
  }
  return [...new Set(labels)];
}

// Better Auth's logs can carry query values, including session tokens. This keeps
// what a log needs for debugging and drops the rest.
export function writeAuthLog(level: string, message: unknown, ...details: unknown[]) {
  const text =
    typeof message === "string"
      ? message.split(/failed query|params:/i)[0].trim()
      : "Error";
  const labels = [message, ...details].flatMap(safeErrorLabels);
  const line = `[auth] ${text}${labels.length ? ` (${labels.join(", ")})` : ""}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  logger: { log: writeAuthLog },
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Name changes go through our own form, which applies the display name rules.
  disabledPaths: ["/update-user"],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account",
    },
  },
  // Keep last: lets Server Actions set cookies.
  plugins: [nextCookies()],
});
