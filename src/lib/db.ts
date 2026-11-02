import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as authSchema from "@/db/auth-schema";
import * as tripSchema from "@/db/trip-schema";

export const db = drizzle(neon(process.env.DATABASE_URL!), {
  schema: { ...authSchema, ...tripSchema },
});
