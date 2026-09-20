import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

process.loadEnvFile(resolve(".env.local"));

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
