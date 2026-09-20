import { jsonError, jsonOk } from "@/lib/api/response";
import {
  SubmissionRepositoryError,
  mergeSubmission,
} from "@/lib/submissions/repository";
import {
  validateMergeSubmissionInput,
  validateUuidParam,
} from "@/lib/submissions/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
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

  const validation = validateMergeSubmissionInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const merged = await mergeSubmission(idResult.data, validation.data);
    return jsonOk({ submission: merged });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      if (
        error.code === "submission_not_found" ||
        error.code === "experience_not_found"
      ) {
        return jsonError(404, "not_found", error.message);
      }

      if (error.code === "invalid_state") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to merge submission");
    }

    return jsonError(500, "database_error", "Unable to merge submission");
  }
}
