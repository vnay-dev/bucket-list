import { jsonError, jsonOk } from "@/lib/api/response";
import {
  SubmissionRepositoryError,
  rejectSubmission,
} from "@/lib/submissions/repository";
import { validateUuidParam } from "@/lib/submissions/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const idResult = validateUuidParam(rawId, "id", "Invalid submission id");

  if (!idResult.ok) {
    return jsonError(400, "invalid_input", idResult.message, idResult.details);
  }

  try {
    const rejected = await rejectSubmission(idResult.data);
    return jsonOk({ submission: rejected });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      if (error.code === "submission_not_found") {
        return jsonError(404, "not_found", error.message);
      }

      if (error.code === "invalid_state") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to reject submission");
    }

    return jsonError(500, "database_error", "Unable to reject submission");
  }
}
