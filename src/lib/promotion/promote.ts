import { randomUUID } from "node:crypto";
import { applyPromotionPlan } from "./apply";
import { createPromotionHttpDb } from "./db";
import {
  assertProductionTargetIsNotDevelopment,
  PromotionEnvError,
} from "./env";
import { ROLLBACK_INSTRUCTIONS } from "./format";
import { createPromotionLogEntry, writePromotionLog } from "./log";
import {
  buildPromotionPlan,
  countPlanActions,
  loadExistingState,
  planHasConflicts,
} from "./plan";
import { selectApprovedContent } from "./select";
import type {
  ExistingState,
  PromoteOptions,
  PromoteResult,
  PromotionCounts,
  PromotionPayload,
  PromotionPlan,
} from "./types";

export type PromoteDependencies = {
  loadPayload: (qaDatabaseUrl: string) => Promise<PromotionPayload>;
  loadExisting: (
    productionDatabaseUrl: string,
    payload: PromotionPayload,
  ) => Promise<ExistingState>;
  applyPlan: (
    productionDatabaseUrl: string,
    plan: PromotionPlan,
  ) => Promise<PromotionCounts>;
  writeLog: typeof writePromotionLog;
  assertNotDevelopmentTarget: (
    productionDatabaseUrl: string,
  ) => void;
};

const emptyCounts = (): PromotionCounts => ({
  placesCreated: 0,
  placesUpdated: 0,
  experiencesCreated: 0,
  experiencesUpdated: 0,
  tagsCreated: 0,
  tagsUpdated: 0,
  relationshipsAdded: 0,
});

export const defaultPromoteDependencies: PromoteDependencies = {
  async loadPayload(qaDatabaseUrl) {
    const qaDb = createPromotionHttpDb(qaDatabaseUrl);
    return selectApprovedContent(qaDb);
  },
  async loadExisting(productionDatabaseUrl, payload) {
    const productionDb = createPromotionHttpDb(productionDatabaseUrl);
    return loadExistingState(productionDb, payload);
  },
  applyPlan: applyPromotionPlan,
  writeLog: writePromotionLog,
  assertNotDevelopmentTarget(productionDatabaseUrl) {
    assertProductionTargetIsNotDevelopment(productionDatabaseUrl);
  },
};

function requireDedicatedUrls(options: PromoteOptions): void {
  if (!options.qaDatabaseUrl?.trim()) {
    throw new PromotionEnvError(
      "QA_DATABASE_URL is required for promotion. Do not use DATABASE_URL.",
    );
  }
  if (!options.productionDatabaseUrl?.trim()) {
    throw new PromotionEnvError(
      "PRODUCTION_DATABASE_URL is required for promotion. Do not use DATABASE_URL.",
    );
  }
  if (
    options.qaDatabaseUrl.trim().replace(/\/+$/, "") ===
    options.productionDatabaseUrl.trim().replace(/\/+$/, "")
  ) {
    throw new PromotionEnvError(
      "QA_DATABASE_URL and PRODUCTION_DATABASE_URL must point to different databases.",
    );
  }
}

/**
 * Orchestrates QA → Production content promotion with validate-then-write semantics.
 */
export async function promoteQaToProduction(
  options: PromoteOptions,
  deps: PromoteDependencies = defaultPromoteDependencies,
): Promise<PromoteResult> {
  const promotionId = options.promotionId ?? randomUUID();

  requireDedicatedUrls(options);
  deps.assertNotDevelopmentTarget(options.productionDatabaseUrl);

  const payload = await deps.loadPayload(options.qaDatabaseUrl);
  const existing = await deps.loadExisting(
    options.productionDatabaseUrl,
    payload,
  );
  const plan = buildPromotionPlan(payload, existing);

  if (planHasConflicts(plan)) {
    const counts = emptyCounts();
    const error = `Validation failed with ${plan.conflicts.length} conflict(s).`;
    await deps.writeLog(
      createPromotionLogEntry({
        promotionId,
        placesCreated: 0,
        placesUpdated: 0,
        experiencesCreated: 0,
        experiencesUpdated: 0,
        tagsCreated: 0,
        tagsUpdated: 0,
        relationshipsAdded: 0,
        status: "aborted",
        error,
        dryRun: options.dryRun,
      }),
      options.logDirectory,
    );

    return {
      promotionId,
      dryRun: options.dryRun,
      status: "aborted",
      plan,
      counts,
      error,
    };
  }

  const plannedCounts = countPlanActions(plan);

  if (options.dryRun) {
    await deps.writeLog(
      createPromotionLogEntry({
        promotionId,
        ...plannedCounts,
        status: "dry_run",
        error: null,
        dryRun: true,
      }),
      options.logDirectory,
    );

    return {
      promotionId,
      dryRun: true,
      status: "dry_run",
      plan,
      counts: plannedCounts,
      error: null,
    };
  }

  if (!options.confirmProduction) {
    const error =
      "Refusing to modify Production without --confirm-production. " +
      "Create a Neon restore point / branch first, then re-run with --confirm-production.\n\n" +
      ROLLBACK_INSTRUCTIONS;
    await deps.writeLog(
      createPromotionLogEntry({
        promotionId,
        ...plannedCounts,
        status: "aborted",
        error: "Missing --confirm-production",
        dryRun: false,
      }),
      options.logDirectory,
    );

    return {
      promotionId,
      dryRun: false,
      status: "aborted",
      plan,
      counts: emptyCounts(),
      error,
    };
  }

  try {
    const counts = await deps.applyPlan(options.productionDatabaseUrl, plan);

    await deps.writeLog(
      createPromotionLogEntry({
        promotionId,
        ...counts,
        status: "success",
        error: null,
        dryRun: false,
      }),
      options.logDirectory,
    );

    return {
      promotionId,
      dryRun: false,
      status: "success",
      plan,
      counts,
      error: null,
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await deps.writeLog(
      createPromotionLogEntry({
        promotionId,
        ...emptyCounts(),
        status: "failure",
        error: message,
        dryRun: false,
      }),
      options.logDirectory,
    );

    return {
      promotionId,
      dryRun: false,
      status: "failure",
      plan,
      counts: emptyCounts(),
      error: message,
    };
  }
}
