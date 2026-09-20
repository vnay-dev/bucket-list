import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { experience, experienceTag, place, tag } from "@/db/schema";
import type {
  AssignTagsInput,
  ExperienceInput,
  ExperienceUpdateInput,
} from "./validation";

export type TagRecord = {
  id: string;
  name: string;
};

export type ExperienceRecord = {
  id: string;
  placeId: string;
  title: string;
  description: string | null;
  goodToKnow: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: TagRecord[];
};

function toExperienceRecord(
  row: typeof experience.$inferSelect,
  tags: TagRecord[] = [],
): ExperienceRecord {
  return {
    id: row.id,
    placeId: row.placeId,
    title: row.title,
    description: row.description,
    goodToKnow: row.goodToKnow,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags,
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

export class ExperienceRepositoryError extends Error {
  readonly code:
    | "place_not_found"
    | "tag_not_found"
    | "duplicate_tag"
    | "foreign_key_violation"
    | "database_error";

  constructor(
    code: ExperienceRepositoryError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ExperienceRepositoryError";
    this.code = code;
  }
}

function mapDatabaseError(error: unknown): never {
  const pgCode = getPostgresErrorCode(error);

  if (pgCode === "23505") {
    throw new ExperienceRepositoryError(
      "duplicate_tag",
      "One or more tags are already assigned to this experience",
      { cause: error },
    );
  }

  if (pgCode === "23503" || pgCode === "23001") {
    throw new ExperienceRepositoryError(
      "foreign_key_violation",
      "Related records prevent this operation",
      { cause: error },
    );
  }

  throw new ExperienceRepositoryError(
    "database_error",
    "A database error occurred",
    { cause: error },
  );
}

async function placeExists(placeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: place.id })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  return rows.length > 0;
}

async function getTagsForExperienceIds(
  experienceIds: string[],
): Promise<Map<string, TagRecord[]>> {
  const tagsByExperienceId = new Map<string, TagRecord[]>();

  for (const experienceId of experienceIds) {
    tagsByExperienceId.set(experienceId, []);
  }

  if (experienceIds.length === 0) {
    return tagsByExperienceId;
  }

  const rows = await db
    .select({
      experienceId: experienceTag.experienceId,
      id: tag.id,
      name: tag.name,
    })
    .from(experienceTag)
    .innerJoin(tag, eq(experienceTag.tagId, tag.id))
    .where(inArray(experienceTag.experienceId, experienceIds))
    .orderBy(asc(tag.name));

  for (const row of rows) {
    const list = tagsByExperienceId.get(row.experienceId) ?? [];
    list.push({ id: row.id, name: row.name });
    tagsByExperienceId.set(row.experienceId, list);
  }

  return tagsByExperienceId;
}

export async function listExperiences(options?: {
  placeId?: string;
}): Promise<ExperienceRecord[]> {
  try {
    const rows = options?.placeId
      ? await db
          .select()
          .from(experience)
          .where(eq(experience.placeId, options.placeId))
          .orderBy(asc(experience.title))
      : await db.select().from(experience).orderBy(asc(experience.title));

    const tagsByExperienceId = await getTagsForExperienceIds(
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      toExperienceRecord(row, tagsByExperienceId.get(row.id) ?? []),
    );
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getExperienceById(
  id: string,
): Promise<ExperienceRecord | null> {
  try {
    const rows = await db
      .select()
      .from(experience)
      .where(eq(experience.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const tagsByExperienceId = await getTagsForExperienceIds([row.id]);
    return toExperienceRecord(row, tagsByExperienceId.get(row.id) ?? []);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function createExperience(
  input: ExperienceInput,
): Promise<ExperienceRecord> {
  try {
    if (!(await placeExists(input.placeId))) {
      throw new ExperienceRepositoryError(
        "place_not_found",
        "Place not found",
      );
    }

    const rows = await db
      .insert(experience)
      .values({
        placeId: input.placeId,
        title: input.title,
        description: input.description,
        goodToKnow: input.goodToKnow,
      })
      .returning();

    const row = rows[0];

    if (!row) {
      throw new ExperienceRepositoryError(
        "database_error",
        "Experience was not created",
      );
    }

    return toExperienceRecord(row, []);
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function updateExperienceById(
  id: string,
  input: ExperienceUpdateInput,
): Promise<ExperienceRecord | null> {
  try {
    if (input.placeId !== undefined && !(await placeExists(input.placeId))) {
      throw new ExperienceRepositoryError(
        "place_not_found",
        "Place not found",
      );
    }

    const rows = await db
      .update(experience)
      .set({
        ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.goodToKnow !== undefined
          ? { goodToKnow: input.goodToKnow }
          : {}),
      })
      .where(eq(experience.id, id))
      .returning();

    const row = rows[0];
    if (!row) {
      return null;
    }

    const tagsByExperienceId = await getTagsForExperienceIds([row.id]);
    return toExperienceRecord(row, tagsByExperienceId.get(row.id) ?? []);
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function deleteExperienceById(id: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(experience)
      .where(eq(experience.id, id))
      .returning({ id: experience.id });

    return rows.length > 0;
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function listExperienceTags(
  experienceId: string,
): Promise<TagRecord[] | null> {
  try {
    const existing = await db
      .select({ id: experience.id })
      .from(experience)
      .where(eq(experience.id, experienceId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    const tagsByExperienceId = await getTagsForExperienceIds([experienceId]);
    return tagsByExperienceId.get(experienceId) ?? [];
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function assignTagsToExperience(
  experienceId: string,
  input: AssignTagsInput,
): Promise<TagRecord[] | null> {
  try {
    const existing = await db
      .select({ id: experience.id })
      .from(experience)
      .where(eq(experience.id, experienceId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    const tagRows = await db
      .select({ id: tag.id })
      .from(tag)
      .where(inArray(tag.id, input.tagIds));

    if (tagRows.length !== input.tagIds.length) {
      throw new ExperienceRepositoryError(
        "tag_not_found",
        "One or more tags were not found",
      );
    }

    await db.insert(experienceTag).values(
      input.tagIds.map((tagId) => ({
        experienceId,
        tagId,
      })),
    );

    const tagsByExperienceId = await getTagsForExperienceIds([experienceId]);
    return tagsByExperienceId.get(experienceId) ?? [];
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function removeTagFromExperience(
  experienceId: string,
  tagId: string,
): Promise<"removed" | "experience_not_found" | "tag_not_assigned"> {
  try {
    const existing = await db
      .select({ id: experience.id })
      .from(experience)
      .where(eq(experience.id, experienceId))
      .limit(1);

    if (existing.length === 0) {
      return "experience_not_found";
    }

    const rows = await db
      .delete(experienceTag)
      .where(
        and(
          eq(experienceTag.experienceId, experienceId),
          eq(experienceTag.tagId, tagId),
        ),
      )
      .returning({ id: experienceTag.id });

    if (rows.length === 0) {
      return "tag_not_assigned";
    }

    return "removed";
  } catch (error) {
    mapDatabaseError(error);
  }
}
