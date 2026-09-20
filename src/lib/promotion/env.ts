/**
 * Environment and connection-string safety for QA → Production promotion.
 * Never uses DATABASE_URL as the promotion target/source — dedicated URLs only.
 */

export class PromotionEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionEnvError";
  }
}

function trimUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeConnectionString(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Parse a Postgres URL without throwing on odd Neon query params.
 * Returns null if the string is not a usable URL.
 */
export function parseDatabaseUrl(connectionString: string): URL | null {
  try {
    // postgres:// and postgresql:// are accepted by the URL constructor in Node.
    return new URL(connectionString);
  } catch {
    return null;
  }
}

/**
 * Heuristics that a connection string points at a development database.
 * Inspects hostname, pathname (db name), and query params — not userinfo (passwords).
 */
export function looksLikeDevelopmentDatabase(connectionString: string): boolean {
  const parsed = parseDatabaseUrl(connectionString);
  if (!parsed) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, "").toLowerCase();
  const branch =
    parsed.searchParams.get("branch")?.toLowerCase() ??
    parsed.searchParams.get("options")?.toLowerCase() ??
    "";

  const markers = ["development", "dev-", "-dev", "_dev", "/dev"];

  const hostLooksDev =
    host.includes("development") ||
    /(^|[.-])dev([.-]|$)/.test(host) ||
    host.startsWith("dev.");

  const dbLooksDev =
    dbName === "dev" ||
    dbName === "development" ||
    dbName.endsWith("_dev") ||
    dbName.endsWith("-dev") ||
    dbName.includes("development");

  const branchLooksDev =
    branch.includes("development") ||
    branch.includes("branch=dev") ||
    /\bdev\b/.test(branch);

  return hostLooksDev || dbLooksDev || branchLooksDev || markers.some((m) => host.includes(m));
}

export type PromotionEnv = {
  qaDatabaseUrl: string;
  productionDatabaseUrl: string;
};

/**
 * Resolve and validate dedicated promotion URLs.
 * Rejects missing/ambiguous URLs and refuses development as the Production target.
 */
export function resolvePromotionEnv(
  env: Record<string, string | undefined> = process.env,
): PromotionEnv {
  const qaDatabaseUrl = trimUrl(env.QA_DATABASE_URL);
  const productionDatabaseUrl = trimUrl(env.PRODUCTION_DATABASE_URL);

  if (!qaDatabaseUrl) {
    throw new PromotionEnvError(
      "QA_DATABASE_URL is required for promotion. Do not use DATABASE_URL.",
    );
  }

  if (!productionDatabaseUrl) {
    throw new PromotionEnvError(
      "PRODUCTION_DATABASE_URL is required for promotion. Do not use DATABASE_URL.",
    );
  }

  if (normalizeConnectionString(qaDatabaseUrl) === normalizeConnectionString(productionDatabaseUrl)) {
    throw new PromotionEnvError(
      "QA_DATABASE_URL and PRODUCTION_DATABASE_URL must point to different databases.",
    );
  }

  if (!parseDatabaseUrl(qaDatabaseUrl)) {
    throw new PromotionEnvError("QA_DATABASE_URL is not a valid database URL.");
  }

  if (!parseDatabaseUrl(productionDatabaseUrl)) {
    throw new PromotionEnvError(
      "PRODUCTION_DATABASE_URL is not a valid database URL.",
    );
  }

  assertProductionTargetIsNotDevelopment(productionDatabaseUrl, env);

  return { qaDatabaseUrl, productionDatabaseUrl };
}

/**
 * Ensures the production target cannot accidentally be the development database.
 */
export function assertProductionTargetIsNotDevelopment(
  productionDatabaseUrl: string,
  env: Record<string, string | undefined> = process.env,
): void {
  const developmentUrl =
    trimUrl(env.DEVELOPMENT_DATABASE_URL) ?? trimUrl(env.DATABASE_URL);

  if (
    developmentUrl &&
    normalizeConnectionString(productionDatabaseUrl) ===
      normalizeConnectionString(developmentUrl)
  ) {
    throw new PromotionEnvError(
      "PRODUCTION_DATABASE_URL must not match the development database (DATABASE_URL / DEVELOPMENT_DATABASE_URL).",
    );
  }

  if (looksLikeDevelopmentDatabase(productionDatabaseUrl)) {
    throw new PromotionEnvError(
      "PRODUCTION_DATABASE_URL looks like a development database. Refusing to promote into it.",
    );
  }
}
