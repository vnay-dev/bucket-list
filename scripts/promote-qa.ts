/**
 * Promote production-ready curated content from QA → Production.
 *
 * Usage:
 *   npm run promote:qa -- --dry-run
 *   npm run promote:qa -- --confirm-production
 *
 * Requires dedicated env vars (never DATABASE_URL):
 *   QA_DATABASE_URL
 *   PRODUCTION_DATABASE_URL
 *
 * See documentation/promotion.md
 */
import { resolve } from "node:path";
import {
  formatPromoteCliOutput,
  promoteQaToProduction,
  resolvePromotionEnv,
  ROLLBACK_INSTRUCTIONS,
} from "../src/lib/promotion";

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    confirmProduction: argv.includes("--confirm-production"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp() {
  console.log(`QA → Production content promotion

Usage:
  npm run promote:qa -- --dry-run
  npm run promote:qa -- --confirm-production

Flags:
  --dry-run              Validate and print the plan; write nothing to Production
  --confirm-production   Required for a real promotion (after creating a Neon restore point)
  --help                 Show this help

Environment (from .env.local via --env-file):
  QA_DATABASE_URL           Source (QA) Postgres URL
  PRODUCTION_DATABASE_URL   Target (Production) Postgres URL

Do not use DATABASE_URL for this command.

${ROLLBACK_INSTRUCTIONS}
`);
}

async function main() {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // Env may already be injected via --env-file
  }

  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.dryRun && args.confirmProduction) {
    console.error("Use either --dry-run or --confirm-production, not both.");
    process.exit(1);
  }

  const { qaDatabaseUrl, productionDatabaseUrl } = resolvePromotionEnv();

  console.log("Source: QA");
  console.log("Target: Production");
  console.log(args.dryRun ? "Mode:   dry-run" : "Mode:   live");
  console.log("");

  if (!args.dryRun) {
    console.log(ROLLBACK_INSTRUCTIONS);
    console.log("");
  }

  const result = await promoteQaToProduction({
    qaDatabaseUrl,
    productionDatabaseUrl,
    dryRun: args.dryRun,
    confirmProduction: args.confirmProduction,
  });

  console.log(formatPromoteCliOutput(result));

  if (result.status === "success" || result.status === "dry_run") {
    process.exit(0);
  }

  process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
