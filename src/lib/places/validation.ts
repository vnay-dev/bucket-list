export type PlaceInput = {
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

export type PlaceUpdateInput = Partial<PlaceInput>;

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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireTrimmedString(
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

  return trimmed;
}

function parseCoordinate(
  value: unknown,
  field: "latitude" | "longitude",
  details: Record<string, string>,
): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    details[field] = `${field} must be a finite number`;
    return null;
  }

  if (field === "latitude" && (numeric < -90 || numeric > 90)) {
    details[field] = "latitude must be between -90 and 90";
    return null;
  }

  if (field === "longitude" && (numeric < -180 || numeric > 180)) {
    details[field] = "longitude must be between -180 and 180";
    return null;
  }

  return numeric;
}

function validateSlugValue(
  value: unknown,
  details: Record<string, string>,
): string | null {
  const slug = requireTrimmedString(value, "slug", details);

  if (slug === null) {
    return null;
  }

  if (!SLUG_PATTERN.test(slug)) {
    details.slug =
      "slug must use lowercase letters, numbers, and single hyphens only";
    return null;
  }

  return slug;
}

export function validateCreatePlaceInput(
  body: unknown,
): ValidationResult<PlaceInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const details: Record<string, string> = {};

  const name = requireTrimmedString(body.name, "name", details);
  const slug = validateSlugValue(body.slug, details);
  const city = requireTrimmedString(body.city, "city", details);
  const state = requireTrimmedString(body.state, "state", details);
  const latitude = parseCoordinate(body.latitude, "latitude", details);
  const longitude = parseCoordinate(body.longitude, "longitude", details);

  if (
    name === null ||
    slug === null ||
    city === null ||
    state === null ||
    latitude === null ||
    longitude === null
  ) {
    return {
      ok: false,
      message: "Invalid place input",
      details,
    };
  }

  return {
    ok: true,
    data: {
      name,
      slug,
      city,
      state,
      latitude,
      longitude,
    },
  };
}

export function validateUpdatePlaceInput(
  body: unknown,
): ValidationResult<PlaceUpdateInput> {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      message: "Request body must be a JSON object",
    };
  }

  const allowedKeys = new Set([
    "name",
    "slug",
    "city",
    "state",
    "latitude",
    "longitude",
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
      message: "At least one field is required to update a place",
    };
  }

  const details: Record<string, string> = {};
  const data: PlaceUpdateInput = {};

  if ("name" in body) {
    const name = requireTrimmedString(body.name, "name", details);
    if (name !== null) {
      data.name = name;
    }
  }

  if ("slug" in body) {
    const slug = validateSlugValue(body.slug, details);
    if (slug !== null) {
      data.slug = slug;
    }
  }

  if ("city" in body) {
    const city = requireTrimmedString(body.city, "city", details);
    if (city !== null) {
      data.city = city;
    }
  }

  if ("state" in body) {
    const state = requireTrimmedString(body.state, "state", details);
    if (state !== null) {
      data.state = state;
    }
  }

  if ("latitude" in body) {
    const latitude = parseCoordinate(body.latitude, "latitude", details);
    if (latitude !== null) {
      data.latitude = latitude;
    }
  }

  if ("longitude" in body) {
    const longitude = parseCoordinate(body.longitude, "longitude", details);
    if (longitude !== null) {
      data.longitude = longitude;
    }
  }

  if (Object.keys(details).length > 0) {
    return {
      ok: false,
      message: "Invalid place input",
      details,
    };
  }

  return {
    ok: true,
    data,
  };
}

export function validateSlugParam(slug: string): ValidationResult<string> {
  const details: Record<string, string> = {};
  const value = validateSlugValue(slug, details);

  if (value === null) {
    return {
      ok: false,
      message: "Invalid place slug",
      details,
    };
  }

  return {
    ok: true,
    data: value,
  };
}
