import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PromotionLogEntry } from "./types";

const DEFAULT_LOG_DIRECTORY = "promotion-logs";

/**
 * Persists a promotion log as JSON under promotion-logs/ (gitignored).
 * Avoids a schema change while still providing an auditable local history.
 */
export async function writePromotionLog(
  entry: PromotionLogEntry,
  logDirectory = DEFAULT_LOG_DIRECTORY,
): Promise<string> {
  await mkdir(logDirectory, { recursive: true });
  const filePath = join(logDirectory, `${entry.promotionId}.json`);
  await writeFile(filePath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  return filePath;
}

export function createPromotionLogEntry(
  partial: Omit<PromotionLogEntry, "timestamp" | "sourceEnvironment" | "targetEnvironment"> & {
    timestamp?: string;
  },
): PromotionLogEntry {
  return {
    promotionId: partial.promotionId,
    timestamp: partial.timestamp ?? new Date().toISOString(),
    sourceEnvironment: "qa",
    targetEnvironment: "production",
    placesCreated: partial.placesCreated,
    placesUpdated: partial.placesUpdated,
    experiencesCreated: partial.experiencesCreated,
    experiencesUpdated: partial.experiencesUpdated,
    tagsCreated: partial.tagsCreated,
    tagsUpdated: partial.tagsUpdated,
    relationshipsAdded: partial.relationshipsAdded,
    status: partial.status,
    error: partial.error,
    dryRun: partial.dryRun,
  };
}
