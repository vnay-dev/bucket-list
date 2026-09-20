import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tag } from "@/db/schema";

export type TagRecord = {
  id: string;
  name: string;
};

export type TagNameInput = {
  name: string;
};

function toTagRecord(row: typeof tag.$inferSelect): TagRecord {
  return {
    id: row.id,
    name: row.name,
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

export class TagRepositoryError extends Error {
  readonly code: "duplicate_name" | "database_error";

  constructor(
    code: TagRepositoryError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "TagRepositoryError";
    this.code = code;
  }
}

function mapDatabaseError(error: unknown): never {
  const pgCode = getPostgresErrorCode(error);

  if (pgCode === "23505") {
    throw new TagRepositoryError(
      "duplicate_name",
      "A tag with this name already exists",
      { cause: error },
    );
  }

  throw new TagRepositoryError("database_error", "A database error occurred", {
    cause: error,
  });
}

/**
 * Lists all tags for curator pickers (admin server-side).
 * There is no public GET /api/tags endpoint yet.
 */
export async function listTags(): Promise<TagRecord[]> {
  try {
    const rows = await db
      .select({
        id: tag.id,
        name: tag.name,
      })
      .from(tag)
      .orderBy(asc(tag.name));

    return rows;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getTagById(id: string): Promise<TagRecord | null> {
  try {
    const rows = await db.select().from(tag).where(eq(tag.id, id)).limit(1);
    const row = rows[0];
    return row ? toTagRecord(row) : null;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function createTag(input: TagNameInput): Promise<TagRecord> {
  try {
    const rows = await db.insert(tag).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new TagRepositoryError("database_error", "Tag was not created");
    }

    return toTagRecord(row);
  } catch (error) {
    if (error instanceof TagRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function updateTagById(
  id: string,
  input: TagNameInput,
): Promise<TagRecord | null> {
  try {
    if (input.name) {
      const existing = await db
        .select({ id: tag.id })
        .from(tag)
        .where(eq(tag.name, input.name))
        .limit(1);

      if (existing.length > 0 && existing[0]!.id !== id) {
        throw new TagRepositoryError(
          "duplicate_name",
          "A tag with this name already exists",
        );
      }
    }

    const rows = await db
      .update(tag)
      .set(input)
      .where(eq(tag.id, id))
      .returning();

    const row = rows[0];
    return row ? toTagRecord(row) : null;
  } catch (error) {
    if (error instanceof TagRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function deleteTagById(id: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(tag)
      .where(eq(tag.id, id))
      .returning({ id: tag.id });

    return rows.length > 0;
  } catch (error) {
    mapDatabaseError(error);
  }
}
