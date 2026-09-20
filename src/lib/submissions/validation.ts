import { validateUuid, validateUuidParam } from "@/lib/experiences/validation";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type CreateSubmissionInput = {
  placeId: string;
  content: string;
  goodToKnow: string | null;
};

export type UpdateSubmissionInput = {
  placeId?: string;
  content?: string;
  goodToKnow?: string | null;
};

export type ApproveSubmissionInput = {
  experienceId?: string;
};

export type MergeSubmissionInput = {
  experienceId: string;
};

export type ListSubmissionsQuery = {
  status?: SubmissionStatus;
  placeId?: string;
  experienceId?: string;
};

export type ValidationSuccess<T> = {
  ok: true;
  data: T;
};

export type ValidationFailure = {
  ok: false;
  message: string;
  details?: Record<string, string>;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const CONTENT_MAX_LENGTH = 10_000;
const GOOD_TO_KNOW_MAX_LENGTH = 10_000;

const ALLOWED_STATUSES = new Set<SubmissionStatus>([
  "pending",
  "approved",
  "rejected",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireTrimmedString(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number,
): string | null {
  if (typeof value !== "string") {
    details[field] = `${field} must be a string`;
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    details[field] = `${field} is required`;
    return null;
  }

  if (trimmed.length > maxLength) {
    details[field] = `${field} must be at most ${maxLength} characters`;
    return null;
  }

  return trimmed;
}

function parseOptionalText(
  value: unknown,
  field: string,
  details: Record<string, string>,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    details[field] = `${field} must be a string or null`;
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length > maxLength) {
    details[field] = `${field} must be at most ${maxLength} characters`;
    return undefined;
  }

  return trimmed;
}

function parseStatus(
  value: string,
  field: string,
  details: Record<string, string>,
): SubmissionStatus | null {
  if (!ALLOWED_STATUSES.has(value as SubmissionStatus)) {
    details[field] = `${field} must be one of pending, approved, rejected`;
    return null;
  }

  return value as SubmissionStatus;
}

export { validateUuidParam };

export function validateCreateSubmissionInput(
  body: unknown,
): ValidationResult<CreateSubmissionInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set(["placeId", "content", "goodToKnow"]);
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: "Request contains unsupported fields",
      details: Object.fromEntries(
        unknownKeys.map((key) => [key, "unsupported field"]),
      ),
    };
  }

  const details: Record<string, string> = {};

  const placeId = validateUuid(body.placeId, "placeId", details);
  const content = requireTrimmedString(
    body.content,
    "content",
    details,
    CONTENT_MAX_LENGTH,
  );

  let goodToKnow: string | null = null;
  if ("goodToKnow" in body) {
    const parsed = parseOptionalText(
      body.goodToKnow,
      "goodToKnow",
      details,
      GOOD_TO_KNOW_MAX_LENGTH,
    );
    if (parsed === undefined && details.goodToKnow) {
      // validation error already recorded
    } else if (parsed !== undefined) {
      goodToKnow = parsed;
    }
  }

  if (placeId === null || content === null || Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid submission input",
      details,
    };
  }

  return {
    ok: true,
    data: {
      placeId,
      content,
      goodToKnow,
    },
  };
}

export function validateUpdateSubmissionInput(
  body: unknown,
): ValidationResult<UpdateSubmissionInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set(["placeId", "content", "goodToKnow"]);
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: "Request contains unsupported fields",
      details: Object.fromEntries(
        unknownKeys.map((key) => [key, "unsupported field"]),
      ),
    };
  }

  if (Object.keys(body).length === 0) {
    return {
      ok: false,
      message: "At least one field is required to update a submission",
    };
  }

  const details: Record<string, string> = {};
  const data: UpdateSubmissionInput = {};

  if ("placeId" in body) {
    const placeId = validateUuid(body.placeId, "placeId", details);
    if (placeId !== null) {
      data.placeId = placeId;
    }
  }

  if ("content" in body) {
    const content = requireTrimmedString(
      body.content,
      "content",
      details,
      CONTENT_MAX_LENGTH,
    );
    if (content !== null) {
      data.content = content;
    }
  }

  if ("goodToKnow" in body) {
    const goodToKnow = parseOptionalText(
      body.goodToKnow,
      "goodToKnow",
      details,
      GOOD_TO_KNOW_MAX_LENGTH,
    );
    if (goodToKnow !== undefined) {
      data.goodToKnow = goodToKnow;
    }
  }

  if (Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid submission input",
      details,
    };
  }

  return {
    ok: true,
    data,
  };
}

export function validateListSubmissionsQuery(
  searchParams: URLSearchParams,
): ValidationResult<ListSubmissionsQuery> {
  const details: Record<string, string> = {};
  const data: ListSubmissionsQuery = {};

  const statusParam = searchParams.get("status");
  if (statusParam !== null) {
    const status = parseStatus(statusParam.trim(), "status", details);
    if (status !== null) {
      data.status = status;
    }
  }

  const placeIdParam = searchParams.get("placeId");
  if (placeIdParam !== null) {
    const placeId = validateUuid(placeIdParam, "placeId", details);
    if (placeId !== null) {
      data.placeId = placeId;
    }
  }

  const experienceIdParam = searchParams.get("experienceId");
  if (experienceIdParam !== null) {
    const experienceId = validateUuid(experienceIdParam, "experienceId", details);
    if (experienceId !== null) {
      data.experienceId = experienceId;
    }
  }

  if (Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid list submissions query",
      details,
    };
  }

  return {
    ok: true,
    data,
  };
}

export function validateApproveSubmissionInput(
  body: unknown,
): ValidationResult<ApproveSubmissionInput> {
  if (body === undefined || body === null) {
    return {
      ok: true,
      data: {},
    };
  }

  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set(["experienceId"]);
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: "Request contains unsupported fields",
      details: Object.fromEntries(
        unknownKeys.map((key) => [key, "unsupported field"]),
      ),
    };
  }

  if (!("experienceId" in body) || body.experienceId === undefined) {
    return {
      ok: true,
      data: {},
    };
  }

  const details: Record<string, string> = {};
  const experienceId = validateUuid(body.experienceId, "experienceId", details);

  if (experienceId === null) {
    return {
      ok: false,
      message: "Invalid approval input",
      details,
    };
  }

  return {
    ok: true,
    data: { experienceId },
  };
}

export function validateMergeSubmissionInput(
  body: unknown,
): ValidationResult<MergeSubmissionInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set(["experienceId"]);
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: "Request contains unsupported fields",
      details: Object.fromEntries(
        unknownKeys.map((key) => [key, "unsupported field"]),
      ),
    };
  }

  const details: Record<string, string> = {};
  const experienceId = validateUuid(body.experienceId, "experienceId", details);

  if (experienceId === null) {
    return {
      ok: false,
      message: "Invalid merge input",
      details,
    };
  }

  return {
    ok: true,
    data: { experienceId },
  };
}
