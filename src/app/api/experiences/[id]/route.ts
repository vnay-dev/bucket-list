import { jsonError, jsonOk } from "@/lib/api/response";
import {
  ExperienceRepositoryError,
  deleteExperienceById,
  getExperienceById,
  updateExperienceById,
} from "@/lib/experiences/repository";
import {
  validateUpdateExperienceInput,
  validateUuidParam,
} from "@/lib/experiences/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(
    rawId,
    "id",
    "Invalid experience id",
  );

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  try {
    const experience = await getExperienceById(idResult.data);

    if (!experience) {
      return jsonError(404, "not_found", "Experience not found");
    }

    return jsonOk({ experience });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve experience");
    }

    return jsonError(500, "database_error", "Unable to retrieve experience");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(
    rawId,
    "id",
    "Invalid experience id",
  );

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateUpdateExperienceInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const updated = await updateExperienceById(idResult.data, validation.data);

    if (!updated) {
      return jsonError(404, "not_found", "Experience not found");
    }

    return jsonOk({ experience: updated });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      if (error.code === "place_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      return jsonError(500, "database_error", "Unable to update experience");
    }

    return jsonError(500, "database_error", "Unable to update experience");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(
    rawId,
    "id",
    "Invalid experience id",
  );

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  try {
    const deleted = await deleteExperienceById(idResult.data);

    if (!deleted) {
      return jsonError(404, "not_found", "Experience not found");
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      if (error.code === "foreign_key_violation") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to delete experience");
    }

    return jsonError(500, "database_error", "Unable to delete experience");
  }
}
