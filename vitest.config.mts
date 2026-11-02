import { configDefaults, defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // These use the real dev database. Run them with: npm.cmd run test:dev-db
    exclude: [...configDefaults.exclude, "**/*.dev-db.test.ts"],
  },
});
