import { jsonError, jsonOk } from "@/lib/api/response";
import {
  SubmissionRepositoryError,
  getSubmissionById,
  updateSubmissionById,
} from "@/lib/submissions/repository";
import {
  validateUpdateSubmissionInput,
  validateUuidParam,
} from "@/lib/submissions/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(rawId, "id", "Invalid submission id");

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  try {
    const submission = await getSubmissionById(idResult.data);

    if (!submission) {
      return jsonError(404, "not_found", "Submission not found");
    }

    return jsonOk({ submission });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve submission");
    }

    return jsonError(500, "database_error", "Unable to retrieve submission");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(rawId, "id", "Invalid submission id");

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateUpdateSubmissionInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const updated = await updateSubmissionById(idResult.data, validation.data);

    if (!updated) {
      return jsonError(404, "not_found", "Submission not found");
    }

    return jsonOk({ submission: updated });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      if (error.code === "place_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      return jsonError(500, "database_error", "Unable to update submission");
    }

    return jsonError(500, "database_error", "Unable to update submission");
  }
}
