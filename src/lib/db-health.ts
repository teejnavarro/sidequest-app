import { neon } from "@neondatabase/serverless";

export type DatabaseHealth = { ok: boolean; ms?: number };

// Asks the database a trivial question ("select 1") and times the answer.
// Never throws and never logs or returns the connection string or error text.
export async function checkDatabase(): Promise<DatabaseHealth> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false };

  try {
    const sql = neon(url);
    const start = performance.now();
    await sql`select 1`;
    return { ok: true, ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false };
  }
}
