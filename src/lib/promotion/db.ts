import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

export type PromotionHttpDb = NeonHttpDatabase<typeof schema>;

/**
 * Creates a read-oriented Drizzle client for a dedicated connection string.
 * Used by promotion so QA/Production never silently fall back to DATABASE_URL.
 */
export function createPromotionHttpDb(databaseUrl: string): PromotionHttpDb {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}
