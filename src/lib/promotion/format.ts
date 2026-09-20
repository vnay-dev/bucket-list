import type { PromotionCounts, PromotionPlan, PromoteResult } from "./types";

export function formatReadySummary(plan: PromotionPlan): string {
  const relationships = plan.experienceTags.length;
  return [
    "QA → Production Promotion",
    "",
    "Ready:",
    `Places:        ${plan.places.length}`,
    `Experiences:   ${plan.experiences.length}`,
    `Tags:          ${plan.tags.length}`,
    `Relationships: ${relationships}`,
  ].join("\n");
}

export function formatApplySummary(counts: PromotionCounts): string {
  return [
    "QA → Production Promotion",
    "",
    `Places created:       ${counts.placesCreated}`,
    `Places updated:       ${counts.placesUpdated}`,
    `Experiences created:  ${counts.experiencesCreated}`,
    `Experiences updated:  ${counts.experiencesUpdated}`,
    `Tags created:         ${counts.tagsCreated}`,
    `Tags updated:         ${counts.tagsUpdated}`,
    `Relationships added:  ${counts.relationshipsAdded}`,
  ].join("\n");
}

export function formatDryRunResult(): string {
  return "Dry run complete. No production changes made.";
}

export function formatSuccessResult(promotionId: string): string {
  return [
    "Promotion successful.",
    `Promotion ID: ${promotionId}`,
  ].join("\n");
}

export function formatConflicts(plan: PromotionPlan): string {
  const lines = [
    "Validation failed. No production changes made.",
    "",
    "Conflicts:",
    ...plan.conflicts.map((conflict) => `- [${conflict.code}] ${conflict.message}`),
  ];
  return lines.join("\n");
}

export function formatPromoteCliOutput(result: PromoteResult): string {
  if (result.status === "aborted" || result.status === "failure") {
    if (result.plan.conflicts.length > 0) {
      return formatConflicts(result.plan);
    }
    return result.error ?? "Promotion aborted.";
  }

  if (result.dryRun) {
    return [
      formatReadySummary(result.plan),
      "",
      formatDryRunResult(),
    ].join("\n");
  }

  return [
    formatApplySummary(result.counts),
    "",
    formatSuccessResult(result.promotionId),
  ].join("\n");
}

export const ROLLBACK_INSTRUCTIONS = `
Rollback / restore point (Neon)
-------------------------------
Before a real promotion, create a restore point in the Neon console:

1. Open the Production project in https://console.neon.tech
2. Prefer one of:
   - Create a temporary branch from the current Production head (instant copy), or
   - Note the current time for Point-in-Time Restore (PITR), if enabled on your plan
3. Keep that branch / timestamp until you have verified Production after promotion

If promotion causes a serious problem:
- Restore Production from the branch (or PITR timestamp) via the Neon console
- Re-run \`npm run promote:qa -- --dry-run\` after restore to inspect state
- Fix the underlying conflict in QA or Production, then promote again

This CLI does not delete or rewrite Neon backups; restore is always done in Neon.
`.trim();
