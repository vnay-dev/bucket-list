import { jsonError, jsonOk } from "@/lib/api/response";
import {
  ExperienceRepositoryError,
  removeTagFromExperience,
} from "@/lib/experiences/repository";
import { validateUuidParam } from "@/lib/experiences/validation";

type RouteContext = {
  params: Promise<{
    id: string;
    tagId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: rawId, tagId: rawTagId } = await context.params;
  const idResult = validateUuidParam(
    rawId,
    "id",
    "Invalid experience id",
  );

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  const tagIdResult = validateUuidParam(
    rawTagId,
    "tagId",
    "Invalid tag id",
  );

  if (!tagIdResult.ok) {
    return jsonError(
      400,
      "invalid_input",
      tagIdResult.message,
      tagIdResult.details,
    );
  }

  try {
    const result = await removeTagFromExperience(
      idResult.data,
      tagIdResult.data,
    );

    if (result === "experience_not_found") {
      return jsonError(404, "not_found", "Experience not found");
    }

    if (result === "tag_not_assigned") {
      return jsonError(404, "not_found", "Tag is not assigned to this experience");
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      return jsonError(500, "database_error", "Unable to remove tag");
    }

    return jsonError(500, "database_error", "Unable to remove tag");
  }
}
