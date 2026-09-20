import { jsonError, jsonOk } from "@/lib/api/response";
import {
  PlaceRepositoryError,
  deletePlaceBySlug,
  getPlaceBySlug,
  updatePlaceBySlug,
} from "@/lib/places/repository";
import {
  validateSlugParam,
  validateUpdatePlaceInput,
} from "@/lib/places/validation";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug: rawSlug } = await context.params;
  const slugResult = validateSlugParam(rawSlug);

  if (!slugResult.ok) {
    return jsonError(400, "invalid_input", slugResult.message, slugResult.details);
  }

  try {
    const place = await getPlaceBySlug(slugResult.data);

    if (!place) {
      return jsonError(404, "not_found", "Place not found");
    }

    return jsonOk({ place });
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve place");
    }

    return jsonError(500, "database_error", "Unable to retrieve place");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: rawSlug } = await context.params;
  const slugResult = validateSlugParam(rawSlug);

  if (!slugResult.ok) {
    return jsonError(400, "invalid_input", slugResult.message, slugResult.details);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateUpdatePlaceInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const updated = await updatePlaceBySlug(slugResult.data, validation.data);

    if (!updated) {
      return jsonError(404, "not_found", "Place not found");
    }

    return jsonOk({ place: updated });
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      if (error.code === "duplicate_slug") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to update place");
    }

    return jsonError(500, "database_error", "Unable to update place");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug: rawSlug } = await context.params;
  const slugResult = validateSlugParam(rawSlug);

  if (!slugResult.ok) {
    return jsonError(400, "invalid_input", slugResult.message, slugResult.details);
  }

  try {
    const deleted = await deletePlaceBySlug(slugResult.data);

    if (!deleted) {
      return jsonError(404, "not_found", "Place not found");
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      if (error.code === "foreign_key_violation") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to delete place");
    }

    return jsonError(500, "database_error", "Unable to delete place");
  }
}
