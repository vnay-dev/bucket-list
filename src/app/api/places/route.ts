import { jsonError, jsonOk } from "@/lib/api/response";
import {
  PlaceRepositoryError,
  createPlace,
  listPlaces,
} from "@/lib/places/repository";
import { validateCreatePlaceInput } from "@/lib/places/validation";

export async function GET() {
  try {
    const places = await listPlaces();
    return jsonOk({ places });
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      return jsonError(500, "database_error", "Unable to retrieve places");
    }

    return jsonError(500, "database_error", "Unable to retrieve places");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Request body must be valid JSON");
  }

  const validation = validateCreatePlaceInput(body);

  if (!validation.ok) {
    return jsonError(400, "invalid_input", validation.message, validation.details);
  }

  try {
    const created = await createPlace(validation.data);
    return jsonOk({ place: created }, 201);
  } catch (error) {
    if (error instanceof PlaceRepositoryError) {
      if (error.code === "duplicate_slug") {
        return jsonError(409, "conflict", error.message);
      }

      return jsonError(500, "database_error", "Unable to create place");
    }

    return jsonError(500, "database_error", "Unable to create place");
  }
}
