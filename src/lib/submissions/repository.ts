import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { experience, place, submission, user } from "@/db/schema";
import type {
  ApproveSubmissionInput,
  CreateSubmissionInput,
  ListSubmissionsQuery,
  MergeSubmissionInput,
  SubmissionStatus,
  UpdateSubmissionInput,
} from "./validation";

const EXPERIENCE_TITLE_MAX_LENGTH = 200;

export type SubmissionRecord = {
  id: string;
  userId: string;
  placeId: string;
  experienceId: string | null;
  content: string;
  goodToKnow: string | null;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
};

function toSubmissionRecord(
  row: typeof submission.$inferSelect,
): SubmissionRecord {
  return {
    id: row.id,
    userId: row.userId,
    placeId: row.placeId,
    experienceId: row.experienceId,
    content: row.content,
    goodToKnow: row.goodToKnow,
    status: row.status as SubmissionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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

export class SubmissionRepositoryError extends Error {
  readonly code:
    | "user_not_found"
    | "place_not_found"
    | "experience_not_found"
    | "submission_not_found"
    | "invalid_state"
    | "foreign_key_violation"
    | "database_error";

  constructor(
    code: SubmissionRepositoryError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SubmissionRepositoryError";
    this.code = code;
  }
}

function mapDatabaseError(error: unknown): never {
  const pgCode = getPostgresErrorCode(error);

  if (pgCode === "23503" || pgCode === "23001") {
    throw new SubmissionRepositoryError(
      "foreign_key_violation",
      "Related records prevent this operation",
      { cause: error },
    );
  }

  if (pgCode === "23514") {
    throw new SubmissionRepositoryError(
      "invalid_state",
      "Submission status violates database constraints",
      { cause: error },
    );
  }

  throw new SubmissionRepositoryError(
    "database_error",
    "A database error occurred",
    { cause: error },
  );
}

async function userExists(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return rows.length > 0;
}

async function placeExists(placeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: place.id })
    .from(place)
    .where(eq(place.id, placeId))
    .limit(1);

  return rows.length > 0;
}

async function experienceExists(experienceId: string): Promise<boolean> {
  const rows = await db
    .select({ id: experience.id })
    .from(experience)
    .where(eq(experience.id, experienceId))
    .limit(1);

  return rows.length > 0;
}

function titleFromContent(content: string): string {
  if (content.length <= EXPERIENCE_TITLE_MAX_LENGTH) {
    return content;
  }

  return content.slice(0, EXPERIENCE_TITLE_MAX_LENGTH);
}

function assertPending(record: SubmissionRecord, action: string): void {
  if (record.status !== "pending") {
    throw new SubmissionRepositoryError(
      "invalid_state",
      `Submission cannot be ${action} unless it is pending`,
    );
  }
}

export async function listSubmissions(
  options: ListSubmissionsQuery = {},
): Promise<SubmissionRecord[]> {
  try {
    const filters = [];

    if (options.status !== undefined) {
      filters.push(eq(submission.status, options.status));
    }

    if (options.placeId !== undefined) {
      filters.push(eq(submission.placeId, options.placeId));
    }

    if (options.experienceId !== undefined) {
      filters.push(eq(submission.experienceId, options.experienceId));
    }

    const rows =
      filters.length > 0
        ? await db
            .select()
            .from(submission)
            .where(and(...filters))
            .orderBy(asc(submission.createdAt))
        : await db.select().from(submission).orderBy(asc(submission.createdAt));

    return rows.map(toSubmissionRecord);
  } catch (error) {
    mapDatabaseError(error);
  }
}

export async function getSubmissionById(
  id: string,
): Promise<SubmissionRecord | null> {
  try {
    const rows = await db
      .select()
      .from(submission)
      .where(eq(submission.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toSubmissionRecord(row);
  } catch (error) {
    mapDatabaseError(error);
  }
}

/**
 * Creates a pending submission for the given authenticated user.
 * `userId` must come from the authentication layer, not from client input.
 */
export async function createSubmission(
  userId: string,
  input: CreateSubmissionInput,
): Promise<SubmissionRecord> {
  try {
    if (!(await userExists(userId))) {
      throw new SubmissionRepositoryError("user_not_found", "User not found");
    }

    if (!(await placeExists(input.placeId))) {
      throw new SubmissionRepositoryError("place_not_found", "Place not found");
    }

    const rows = await db
      .insert(submission)
      .values({
        userId,
        placeId: input.placeId,
        content: input.content,
        goodToKnow: input.goodToKnow,
        status: "pending",
      })
      .returning();

    const row = rows[0];

    if (!row) {
      throw new SubmissionRepositoryError(
        "database_error",
        "Submission was not created",
      );
    }

    return toSubmissionRecord(row);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function updateSubmissionById(
  id: string,
  input: UpdateSubmissionInput,
): Promise<SubmissionRecord | null> {
  try {
    if (input.placeId !== undefined && !(await placeExists(input.placeId))) {
      throw new SubmissionRepositoryError("place_not_found", "Place not found");
    }

    const rows = await db
      .update(submission)
      .set({
        ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.goodToKnow !== undefined
          ? { goodToKnow: input.goodToKnow }
          : {}),
      })
      .where(eq(submission.id, id))
      .returning();

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toSubmissionRecord(row);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function approveSubmission(
  id: string,
  input: ApproveSubmissionInput = {},
): Promise<SubmissionRecord> {
  try {
    const existing = await getSubmissionById(id);

    if (!existing) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    assertPending(existing, "approved");

    let experienceId = input.experienceId;

    if (experienceId !== undefined) {
      if (!(await experienceExists(experienceId))) {
        throw new SubmissionRepositoryError(
          "experience_not_found",
          "Experience not found",
        );
      }
    } else {
      const created = await db
        .insert(experience)
        .values({
          placeId: existing.placeId,
          title: titleFromContent(existing.content),
          description: existing.content,
          goodToKnow: existing.goodToKnow,
        })
        .returning({ id: experience.id });

      const createdRow = created[0];

      if (!createdRow) {
        throw new SubmissionRepositoryError(
          "database_error",
          "Experience was not created during approval",
        );
      }

      experienceId = createdRow.id;
    }

    const rows = await db
      .update(submission)
      .set({
        status: "approved",
        experienceId,
      })
      .where(eq(submission.id, id))
      .returning();

    const row = rows[0];

    if (!row) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    return toSubmissionRecord(row);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function rejectSubmission(id: string): Promise<SubmissionRecord> {
  try {
    const existing = await getSubmissionById(id);

    if (!existing) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    assertPending(existing, "rejected");

    const rows = await db
      .update(submission)
      .set({
        status: "rejected",
      })
      .where(eq(submission.id, id))
      .returning();

    const row = rows[0];

    if (!row) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    return toSubmissionRecord(row);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}

export async function mergeSubmission(
  id: string,
  input: MergeSubmissionInput,
): Promise<SubmissionRecord> {
  try {
    const existing = await getSubmissionById(id);

    if (!existing) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    assertPending(existing, "merged");

    if (!(await experienceExists(input.experienceId))) {
      throw new SubmissionRepositoryError(
        "experience_not_found",
        "Experience not found",
      );
    }

    const rows = await db
      .update(submission)
      .set({
        status: "approved",
        experienceId: input.experienceId,
      })
      .where(eq(submission.id, id))
      .returning();

    const row = rows[0];

    if (!row) {
      throw new SubmissionRepositoryError(
        "submission_not_found",
        "Submission not found",
      );
    }

    return toSubmissionRecord(row);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      throw error;
    }

    mapDatabaseError(error);
  }
}
