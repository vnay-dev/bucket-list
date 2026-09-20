/**
 * Controlled promotion of an existing User to superadmin.
 *
 * Usage (after the person has signed in once with Google):
 *   npx tsx --env-file=.env.local scripts/promote-superadmin.ts you@example.com
 *
 * Prefer this over hardcoding emails in application code.
 * Optional alternative: set INITIAL_SUPERADMIN_EMAIL before the first
 * matching Google sign-in when no superadmin exists yet.
 */
import { resolve } from "node:path";
import { promoteUserToSuperAdmin } from "../src/lib/auth/users";

async function main() {
  // Ensure DATABASE_URL is available when run outside npm scripts.
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Env may already be injected via --env-file
  }

  const email = process.argv[2];

  if (!email) {
    console.error(
      "Usage: npx tsx --env-file=.env.local scripts/promote-superadmin.ts <email>",
    );
    process.exit(1);
  }

  const updated = await promoteUserToSuperAdmin(email);
  console.log(`Promoted ${updated.email} to superadmin (id=${updated.id}).`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
