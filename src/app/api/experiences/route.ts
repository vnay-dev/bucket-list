import { jsonError, jsonOk } from "@/lib/api/response";
import {
  ExperienceRepositoryError,
  createExperience,
  listExperiences,
} from "@/lib/experiences/repository";
import {
  validateCreateExperienceInput,
  validateListExperiencesQuery,
} from "@/lib/experiences/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryResult = validateListExperiencesQuery(searchParams);

  if (!queryResult.ok) {
    return jsonError(
      400,
      "invalid_input",
      queryResult.message,
      queryResult.details,
    );
  }

  try {
    const experiences = await listExperiences(queryResult.data);
    return jsonOk({ experiences });
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve experiences");
    }

    return jsonError(500, "database_error", "Unable to retrieve experiences");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateCreateExperienceInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const created = await createExperience(validation.data);
    return jsonOk({ experience: created }, 201);
  } catch (error) {
    if (error instanceof ExperienceRepositoryError) {
      if (error.code === "place_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      return jsonError(500, "database_error", "Unable to create experience");
    }

    return jsonError(500, "database_error", "Unable to create experience");
  }
}
