export type TagNameInput = {
  name: string;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTagNameInput(
  body: unknown,
): ValidationResult<TagNameInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const details: Record<string, string> = {};

  if (typeof body.name !== "string") {
    details.name = "name must be a string";
    return {
      ok: false,
      message: "Invalid tag input",
      details,
    };
  }

  const name = body.name.trim();

  if (name.length === 0) {
    details.name = "name is required";
    return {
      ok: false,
      message: "Invalid tag input",
      details,
    };
  }

  return {
    ok: true,
    data: { name },
  };
}
