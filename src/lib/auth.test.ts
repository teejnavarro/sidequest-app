import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const BASE = "http://localhost:3000";
const SECRET = "made-up-test-secret-made-up-test-secret";

function post(path: string, body: unknown) {
  return new Request(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify(body),
  });
}

// The real app config. These requests are refused before any database call,
// so the made-up address below is never contacted.
describe("auth config", () => {
  let auth: typeof import("./auth").auth;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.invalid/test");
    vi.stubEnv("BETTER_AUTH_URL", BASE);
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    vi.stubEnv("GOOGLE_CLIENT_ID", "made-up-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "made-up-value");
    ({ auth } = await import("./auth"));
  });

  it("keeps the public profile update address closed", async () => {
    for (const path of ["/update-user", "/update-user/"]) {
      const res = await auth.handler(post(path, { name: "x".repeat(100) }));
      expect(res.status).toBe(404);
    }
  });

  it("has password sign-in switched off", async () => {
    expect(auth.options).not.toHaveProperty("emailAndPassword");
    const credentials = { name: "Maya Cruz", email: "maya@example.test", password: "made-up-pass-123" };
    for (const path of ["/sign-up/email", "/sign-in/email", "/request-password-reset"]) {
      const res = await auth.handler(post(path, credentials));
      expect(res.status).toBe(400);
    }
  });

  it("only offers Google", () => {
    expect(Object.keys(auth.options.socialProviders)).toEqual(["google"]);
  });
});

describe("auth logs", () => {
  const TOKEN = "made-up-session-token-1234567890";
  const hanging = Object.assign(new Error("fetch() rejects when the prerender is complete"), {
    digest: "HANGING_PROMISE_REJECTION",
  });
  const failed = new DrizzleQueryError('select * from "session" where token = $1', [TOKEN], hanging);

  function captureLogs() {
    return (["error", "warn", "log"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
  }
  const printed = (spies: ReturnType<typeof captureLogs>) =>
    JSON.stringify(spies.flatMap((spy) => spy.mock.calls));

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("drops tokens from a real failed-query error going through Better Auth's logger", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@db.invalid/test");
    vi.stubEnv("BETTER_AUTH_URL", BASE);
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    const { auth } = await import("./auth");
    const { logger } = await auth.$context;
    const spies = captureLogs();

    logger.error("INTERNAL_SERVER_ERROR", failed);

    const output = printed(spies);
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain("select");
    expect(output).toContain("INTERNAL_SERVER_ERROR");
    expect(output).toContain("HANGING_PROMISE_REJECTION");
  });

  it("drops tokens when the error itself is passed as the message", async () => {
    const { writeAuthLog } = await import("./auth");
    const spies = captureLogs();
    writeAuthLog("error", failed);
    expect(printed(spies)).not.toContain(TOKEN);
  });

  it("drops tokens from message text, plain details and nested causes", async () => {
    const { writeAuthLog } = await import("./auth");
    const spies = captureLogs();
    writeAuthLog("warn", `Lookup broke. Failed query: select 1\nparams: ${TOKEN}`, TOKEN, {
      token: TOKEN,
    });
    writeAuthLog("error", "Outer", new Error("Outer", { cause: failed }));
    const output = printed(spies);
    expect(output).not.toContain(TOKEN);
    expect(output).toContain("Lookup broke.");
    expect(output).toContain("HANGING_PROMISE_REJECTION");
  });

  it("does not repeat a code or name that is shaped like a token", async () => {
    const { writeAuthLog } = await import("./auth");
    const spies = captureLogs();
    writeAuthLog("error", "Oops", Object.assign(new Error("x"), { code: TOKEN, name: TOKEN }));
    expect(printed(spies)).not.toContain(TOKEN);
  });
});

// The profile form relies on this: closing the public address must not stop
// our own server code from saving. Uses a throwaway in-memory database, and
// password sign-up only to get a test session; the real app has it switched off.
describe("closing /update-user", () => {
  it("still lets server code update the name", async () => {
    const tables = { user: [], session: [], account: [], verification: [] };
    const testAuth = betterAuth({
      baseURL: BASE,
      secret: SECRET,
      database: memoryAdapter(tables),
      emailAndPassword: { enabled: true },
      disabledPaths: ["/update-user"],
    });

    const signUp = await testAuth.api.signUpEmail({
      body: { name: "Maya Cruz", email: "maya@example.test", password: "made-up-pass-123" },
      returnHeaders: true,
    });
    const cookie = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const headers = new Headers({ cookie });

    await testAuth.api.updateUser({ body: { name: "Maya C" }, headers });

    const session = await testAuth.api.getSession({ headers });
    expect(session?.user.name).toBe("Maya C");

    const blocked = new Request(`${BASE}/api/auth/update-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie },
      body: JSON.stringify({ name: "Bypass" }),
    });
    expect((await testAuth.handler(blocked)).status).toBe(404);
    expect((await testAuth.api.getSession({ headers }))?.user.name).toBe("Maya C");
  });
});
