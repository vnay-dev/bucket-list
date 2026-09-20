export type ExperienceInput = {
  placeId: string;
  title: string;
  description: string | null;
  goodToKnow: string | null;
};

export type ExperienceUpdateInput = Partial<ExperienceInput>;

export type AssignTagsInput = {
  tagIds: string[];
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TITLE_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 10_000;
const GOOD_TO_KNOW_MAX_LENGTH = 10_000;

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

export function validateUuid(
  value: unknown,
  field: string,
  details: Record<string, string>,
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

  if (!UUID_PATTERN.test(trimmed)) {
    details[field] = `${field} must be a valid UUID`;
    return null;
  }

  return trimmed.toLowerCase();
}

export function validateUuidParam(
  value: string,
  field: string,
  message: string,
): ValidationResult<string> {
  const details: Record<string, string> = {};
  const id = validateUuid(value, field, details);

  if (id === null) {
    return {
      ok: false,
      message,
      details,
    };
  }

  return {
    ok: true,
    data: id,
  };
}

export function validateCreateExperienceInput(
  body: unknown,
): ValidationResult<ExperienceInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const details: Record<string, string> = {};

  const placeId = validateUuid(body.placeId, "placeId", details);
  const title = requireTrimmedString(
    body.title,
    "title",
    details,
    TITLE_MAX_LENGTH,
  );

  let description: string | null = null;
  if ("description" in body) {
    const parsed = parseOptionalText(
      body.description,
      "description",
      details,
      DESCRIPTION_MAX_LENGTH,
    );
    if (parsed === undefined && details.description) {
      // validation error already recorded
    } else if (parsed !== undefined) {
      description = parsed;
    }
  }

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

  if (placeId === null || title === null || Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid experience input",
      details,
    };
  }

  return {
    ok: true,
    data: {
      placeId,
      title,
      description,
      goodToKnow,
    },
  };
}

export function validateUpdateExperienceInput(
  body: unknown,
): ValidationResult<ExperienceUpdateInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set([
    "placeId",
    "title",
    "description",
    "goodToKnow",
  ]);
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
      message: "At least one field is required to update an experience",
    };
  }

  const details: Record<string, string> = {};
  const data: ExperienceUpdateInput = {};

  if ("placeId" in body) {
    const placeId = validateUuid(body.placeId, "placeId", details);
    if (placeId !== null) {
      data.placeId = placeId;
    }
  }

  if ("title" in body) {
    const title = requireTrimmedString(
      body.title,
      "title",
      details,
      TITLE_MAX_LENGTH,
    );
    if (title !== null) {
      data.title = title;
    }
  }

  if ("description" in body) {
    const description = parseOptionalText(
      body.description,
      "description",
      details,
      DESCRIPTION_MAX_LENGTH,
    );
    if (description !== undefined) {
      data.description = description;
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
      message: "Invalid experience input",
      details,
    };
  }

  return {
    ok: true,
    data,
  };
}

export function validateListExperiencesQuery(
  searchParams: URLSearchParams,
): ValidationResult<{ placeId?: string }> {
  const placeIdParam = searchParams.get("placeId");

  if (placeIdParam === null) {
    return {
      ok: true,
      data: {},
    };
  }

  const details: Record<string, string> = {};
  const placeId = validateUuid(placeIdParam, "placeId", details);

  if (placeId === null) {
    return {
      ok: false,
      message: "Invalid placeId query parameter",
      details,
    };
  }

  return {
    ok: true,
    data: { placeId },
  };
}

export function validateAssignTagsInput(
  body: unknown,
): ValidationResult<AssignTagsInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set(["tagIds"]);
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

  if (!("tagIds" in body)) {
    return {
      ok: false,
      message: "Invalid tag assignment input",
      details: {
        tagIds: "tagIds is required",
      },
    };
  }

  if (!Array.isArray(body.tagIds)) {
    return {
      ok: false,
      message: "Invalid tag assignment input",
      details: {
        tagIds: "tagIds must be an array",
      },
    };
  }

  if (body.tagIds.length === 0) {
    return {
      ok: false,
      message: "Invalid tag assignment input",
      details: {
        tagIds: "tagIds must contain at least one tag id",
      },
    };
  }

  const details: Record<string, string> = {};
  const tagIds: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < body.tagIds.length; index += 1) {
    const field = `tagIds[${index}]`;
    const tagId = validateUuid(body.tagIds[index], field, details);

    if (tagId === null) {
      continue;
    }

    if (seen.has(tagId)) {
      details[field] = "duplicate tag id in request";
      continue;
    }

    seen.add(tagId);
    tagIds.push(tagId);
  }

  if (Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid tag assignment input",
      details,
    };
  }

  return {
    ok: true,
    data: { tagIds },
  };
}
