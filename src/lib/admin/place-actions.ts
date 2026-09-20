"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurator } from "@/lib/auth/authenticated-user";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  PlaceRepositoryError,
  createPlace,
  deletePlaceBySlug,
  updatePlaceBySlug,
} from "@/lib/places/repository";
import { validateCreatePlaceInput } from "@/lib/places/validation";

export type PlaceMutationResult =
  | { ok: true; slug?: string }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "invalid_input"
        | "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside a Next.js request context (e.g. unit tests).
  }
}

function mapAuthError(error: unknown): PlaceMutationResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function mapPlaceError(error: unknown): PlaceMutationResult {
  if (error instanceof PlaceRepositoryError) {
    if (error.code === "duplicate_slug") {
      return {
        ok: false,
        code: "conflict",
        message: "A place with this slug already exists.",
        fieldErrors: { slug: "A place with this slug already exists." },
      };
    }

    if (error.code === "foreign_key_violation") {
      return {
        ok: false,
        code: "conflict",
        message:
          "This place cannot be deleted because it is still used by experiences or submissions. Remove or reassign that content first.",
      };
    }
  }

  return {
    ok: false,
    code: "error",
    message: "Unable to update the place. Please try again.",
  };
}

function redirectCreated(slug: string): never {
  redirect(`/admin/places/${slug}?notice=created`);
}

function redirectDeleted(): never {
  redirect("/admin/places?notice=deleted");
}

function redirectUpdated(slug: string): never {
  redirect(`/admin/places/${slug}?notice=updated`);
}

export async function createPlaceAction(input: {
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
}): Promise<PlaceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const validation = validateCreatePlaceInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors: validation.details,
    };
  }

  let slug: string;

  try {
    const created = await createPlace(validation.data);
    slug = created.slug;
  } catch (error) {
    return mapPlaceError(error);
  }

  safeRevalidatePath("/admin/places");
  redirectCreated(slug);
}

export async function updatePlaceAction(input: {
  currentSlug: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: string;
  longitude: string;
}): Promise<PlaceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const validation = validateCreatePlaceInput({
    name: input.name,
    slug: input.slug,
    city: input.city,
    state: input.state,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors: validation.details,
    };
  }

  let updatedSlug: string;

  try {
    const updated = await updatePlaceBySlug(input.currentSlug, validation.data);
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "Place not found.",
      };
    }
    updatedSlug = updated.slug;
  } catch (error) {
    return mapPlaceError(error);
  }

  safeRevalidatePath("/admin/places");
  safeRevalidatePath(`/admin/places/${input.currentSlug}`);
  safeRevalidatePath(`/admin/places/${updatedSlug}`);

  if (updatedSlug !== input.currentSlug) {
    redirectUpdated(updatedSlug);
  }

  return { ok: true, slug: updatedSlug };
}

export async function deletePlaceAction(input: {
  slug: string;
}): Promise<PlaceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    const deleted = await deletePlaceBySlug(input.slug);
    if (!deleted) {
      return {
        ok: false,
        code: "not_found",
        message: "Place not found.",
      };
    }
  } catch (error) {
    return mapPlaceError(error);
  }

  safeRevalidatePath("/admin/places");
  redirectDeleted();
}
