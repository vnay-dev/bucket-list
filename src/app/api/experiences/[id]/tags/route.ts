import { jsonError, jsonOk } from "@/lib/api/response";
import {
  ExperienceRepositoryError,
  assignTagsToExperience,
  listExperienceTags,
} from "@/lib/experiences/repository";
import {
  validateAssignTagsInput,
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
    const tags = await listExperienceTags(idResult.data);

    if (tags === null) {
      return jsonError(404, "not_found", "Experience not found");
    }

    return jsonOk({ tags });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      return jsonError(
        500,
        "database_error",
        "Unable to retrieve experience tags",
      );
    }

    return jsonError(
      500,
      "database_error",
      "Unable to retrieve experience tags",
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
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

  const validation = validateAssignTagsInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const tags = await assignTagsToExperience(idResult.data, validation.data);

    if (tags === null) {
      return jsonError(404, "not_found", "Experience not found");
    }

    return jsonOk({ tags }, 201);
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      if (error.code === "tag_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      if (error.code === "duplicate_tag") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to assign tags");
    }

    return jsonError(500, "database_error", "Unable to assign tags");
  }
}
