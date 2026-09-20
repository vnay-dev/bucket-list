import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { place } from "@/db/schema";
import type { PlaceInput, PlaceUpdateInput } from "./validation";

export type PlaceRecord = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

function toPlaceRecord(row: typeof place.$inferSelect): PlaceRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    typeof error.cause.code === "string"
  ) {
    return error.cause.code;
  }

  return undefined;
}

export class PlaceRepositoryError extends Error {
  readonly code: "duplicate_slug" | "foreign_key_violation" | "database_error";

  constructor(
    code: PlaceRepositoryError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PlaceRepositoryError";
    this.code = code;
  }
}

function mapDatabaseError(error: unknown): never {
  const pgCode = getPostgresErrorCode(error);

  if (pgCode === "23505") {
    throw new PlaceRepositoryError(
      "duplicate_slug",
      "A place with this slug already exists",
      { cause: error },
    );
  }

  // 23503 = foreign_key_violation, 23001 = restrict_violation (ON DELETE RESTRICT)
  if (pgCode === "23503" || pgCode === "23001") {
    throw new PlaceRepositoryError(
      "foreign_key_violation",
      "Place cannot be deleted while related records exist",
      { cause: error },
    );
  }

  throw new PlaceRepositoryError(
    "database_error",
    "A database error occurred",
    { cause: error },
  );
}

export async function listPlaces(): Promise<PlaceRecord[]> {
  try {
    const rows = await db.select().from(place).orderBy(asc(place.name));
    return rows.map(toPlaceRecord);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getPlaceBySlug(
  slug: string,
): Promise<PlaceRecord | null> {
  try {
    const rows = await db
      .select()
      .from(place)
      .where(eq(place.slug, slug))
      .limit(1);

    const row = rows[0];
    return row ? toPlaceRecord(row) : null;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function createPlace(input: PlaceInput): Promise<PlaceRecord> {
  try {
    const rows = await db.insert(place).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new PlaceRepositoryError(
        "database_error",
        "Place was not created",
      );
    }

    return toPlaceRecord(row);
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function updatePlaceBySlug(
  slug: string,
  input: PlaceUpdateInput,
): Promise<PlaceRecord | null> {
  try {
    if (input.slug && input.slug !== slug) {
      const existing = await db
        .select({ id: place.id })
        .from(place)
        .where(eq(place.slug, input.slug))
        .limit(1);

      if (existing.length > 0) {
        throw new PlaceRepositoryError(
          "duplicate_slug",
          "A place with this slug already exists",
        );
      }
    }

    const rows = await db
      .update(place)
      .set(input)
      .where(eq(place.slug, slug))
      .returning();

    const row = rows[0];
    return row ? toPlaceRecord(row) : null;
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function deletePlaceBySlug(slug: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(place)
      .where(eq(place.slug, slug))
      .returning({ id: place.id });

    return rows.length > 0;
  } catch (error) {
    mapDatabaseError(error);
  }
}
