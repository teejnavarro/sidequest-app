import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Only the demo trip seed for the homepage screenshots. See scripts/demo-trip.seed.ts.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: "node", include: ["scripts/demo-trip.seed.ts"], testTimeout: 120_000 },
});
