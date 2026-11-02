import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  neon: vi.fn<(address: string) => string>(() => "client"),
  drizzle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: mocks.drizzle }));

const MAIN = "postgresql://made:up@main.invalid/db";
const PREVIEW = "postgresql://made:up@preview.invalid/db";

async function addressUsed() {
  vi.resetModules();
  await import("./db");
  return mocks.neon.mock.lastCall?.[0];
}

describe("which database the app connects to", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("DATABASE_URL", MAIN);
  });

  it("uses DATABASE_URL when no preview setting exists", async () => {
    vi.stubEnv("PREVIEW_DATABASE_URL", undefined);
    await expect(addressUsed()).resolves.toBe(MAIN);
  });

  it("uses DATABASE_URL when the preview setting is blank, as in .env.example", async () => {
    vi.stubEnv("PREVIEW_DATABASE_URL", "");
    await expect(addressUsed()).resolves.toBe(MAIN);
  });

  it("uses the preview setting when it has a value", async () => {
    vi.stubEnv("PREVIEW_DATABASE_URL", PREVIEW);
    await expect(addressUsed()).resolves.toBe(PREVIEW);
  });
});
