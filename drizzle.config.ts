import { defineConfig } from "drizzle-kit";

// Which database drizzle-kit talks to. process.loadEnvFile never overrides a
// value that is already set, so the first file that has DATABASE_URL wins.
// Default: the dev database. Production needs DB_ENV_FILE set on purpose.
if (process.env.DB_ENV_FILE) {
  try {
    process.loadEnvFile(process.env.DB_ENV_FILE);
  } catch {}
} else {
  try {
    process.loadEnvFile(".env.development.local");
  } catch {}
  try {
    process.loadEnvFile(".env.local");
  } catch {}
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/auth-schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
