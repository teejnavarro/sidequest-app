import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Only the tests that use the real dev database. See src/lib/trips.dev-db.test.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", include: ["src/**/*.dev-db.test.ts"] },
});
