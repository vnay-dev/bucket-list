import { jsonError, jsonOk } from "@/lib/api/response";
import {
  SubmissionRepositoryError,
  approveSubmission,
} from "@/lib/submissions/repository";
import {
  validateApproveSubmissionInput,
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

  let body: unknown = null;

  try {
    const raw = await request.text();
    if (raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateApproveSubmissionInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const approved = await approveSubmission(idResult.data, validation.data);
    return jsonOk({ submission: approved });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      if (error.code === "submission_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      if (error.code === "experience_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      if (error.code === "invalid_state") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to approve submission");
    }

    return jsonError(500, "database_error", "Unable to approve submission");
  }
}
