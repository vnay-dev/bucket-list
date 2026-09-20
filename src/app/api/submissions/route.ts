import { jsonError, jsonOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/authenticated-user";
import {
  SubmissionRepositoryError,
  createSubmission,
  listSubmissions,
} from "@/lib/submissions/repository";
import {
  validateCreateSubmissionInput,
  validateListSubmissionsQuery,
} from "@/lib/submissions/validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryResult = validateListSubmissionsQuery(searchParams);

  if (!queryResult.ok) {
    return jsonError(
      400,
      "invalid_input",
      queryResult.message,
      queryResult.details,
    );
  }

  try {
    const submissions = await listSubmissions(queryResult.data);
    return jsonOk({ submissions });
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve submissions");
    }

    return jsonError(500, "database_error", "Unable to retrieve submissions");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateCreateSubmissionInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  const authenticatedUser = await getAuthenticatedUser(request);

  if (!authenticatedUser) {
    return jsonError(
      401,
      "unauthorized",
      "Authentication required to create a submission",
    );
  }

  try {
    const created = await createSubmission(
      authenticatedUser.userId,
      validation.data,
    );
    return jsonOk({ submission: created }, 201);
  } catch (error) {
    if (error instanceof SubmissionRepositoryError) {
      if (
        error.code === "place_not_found" ||
        error.code === "user_not_found"
      ) {
        return jsonError(404, "not_found", error.message);
      }

      return jsonError(500, "database_error", "Unable to create submission");
    }

    return jsonError(500, "database_error", "Unable to create submission");
  }
}
