"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurator } from "@/lib/auth/authenticated-user";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  ExperienceRepositoryError,
  assignTagsToExperience,
  createExperience,
  deleteExperienceById,
  removeTagFromExperience,
  updateExperienceById,
} from "@/lib/experiences/repository";

export type ExperienceMutationResult =
  | { ok: true; experienceId?: string; tags?: { id: string; name: string }[] }
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

function mapAuthError(error: unknown): ExperienceMutationResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function mapExperienceError(error: unknown): ExperienceMutationResult {
  if (error instanceof ExperienceRepositoryError) {
    if (error.code === "place_not_found") {
      return { ok: false, code: "not_found", message: "Place not found." };
    }
    if (error.code === "tag_not_found") {
      return {
        ok: false,
        code: "not_found",
        message: "One or more tags were not found.",
      };
    }
    if (error.code === "duplicate_tag") {
      return {
        ok: false,
        code: "conflict",
        message: "One or more tags are already assigned.",
      };
    }
    if (error.code === "foreign_key_violation") {
      return {
        ok: false,
        code: "conflict",
        message: "Related records prevent this operation.",
      };
    }
  }

  return {
    ok: false,
    code: "error",
    message: "Unable to update the experience. Please try again.",
  };
}

function redirectCreated(experienceId: string): never {
  redirect(`/admin/experiences/${experienceId}?notice=created`);
}

function redirectDeleted(): never {
  redirect("/admin/experiences?notice=deleted");
}

function validateExperienceFields(input: {
  title: string;
  description: string;
  goodToKnow: string;
  placeId: string;
}): { fieldErrors: Record<string, string>; values: {
  title: string;
  description: string | null;
  goodToKnow: string | null;
  placeId: string;
} } {
  const title = input.title.trim();
  const description = input.description.trim();
  const goodToKnow = input.goodToKnow.trim();
  const placeId = input.placeId.trim();
  const fieldErrors: Record<string, string> = {};

  if (!title) {
    fieldErrors.title = "Title is required.";
  } else if (title.length > 200) {
    fieldErrors.title = "Title must be at most 200 characters.";
  }

  if (description.length > 10_000) {
    fieldErrors.description = "Description must be at most 10000 characters.";
  }

  if (goodToKnow.length > 10_000) {
    fieldErrors.goodToKnow = "Good to know must be at most 10000 characters.";
  }

  if (!placeId) {
    fieldErrors.placeId = "Place is required.";
  }

  return {
    fieldErrors,
    values: {
      title,
      description: description.length > 0 ? description : null,
      goodToKnow: goodToKnow.length > 0 ? goodToKnow : null,
      placeId,
    },
  };
}

export async function createExperienceAction(input: {
  title: string;
  description: string;
  goodToKnow: string;
  placeId: string;
  tagIds: string[];
}): Promise<ExperienceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const { fieldErrors, values } = validateExperienceFields(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  let experienceId: string;

  try {
    const created = await createExperience(values);
    experienceId = created.id;

    const uniqueTagIds = [...new Set(input.tagIds.filter(Boolean))];
    if (uniqueTagIds.length > 0) {
      await assignTagsToExperience(experienceId, { tagIds: uniqueTagIds });
    }
  } catch (error) {
    return mapExperienceError(error);
  }

  safeRevalidatePath("/admin/experiences");
  redirectCreated(experienceId);
}

export async function updateExperienceAction(input: {
  experienceId: string;
  title: string;
  description: string;
  goodToKnow: string;
  placeId: string;
}): Promise<ExperienceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const { fieldErrors, values } = validateExperienceFields(input);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    const updated = await updateExperienceById(input.experienceId, values);
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "Experience not found.",
      };
    }
  } catch (error) {
    return mapExperienceError(error);
  }

  safeRevalidatePath("/admin/experiences");
  safeRevalidatePath(`/admin/experiences/${input.experienceId}`);
  return { ok: true, experienceId: input.experienceId };
}

export async function deleteExperienceAction(input: {
  experienceId: string;
}): Promise<ExperienceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    const deleted = await deleteExperienceById(input.experienceId);
    if (!deleted) {
      return {
        ok: false,
        code: "not_found",
        message: "Experience not found.",
      };
    }
  } catch (error) {
    return mapExperienceError(error);
  }

  safeRevalidatePath("/admin/experiences");
  redirectDeleted();
}

export async function assignExperienceTagAction(input: {
  experienceId: string;
  tagId: string;
}): Promise<ExperienceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!input.tagId.trim()) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Select a tag to add.",
    };
  }

  try {
    const tags = await assignTagsToExperience(input.experienceId, {
      tagIds: [input.tagId.trim()],
    });
    if (tags === null) {
      return {
        ok: false,
        code: "not_found",
        message: "Experience not found.",
      };
    }
    safeRevalidatePath(`/admin/experiences/${input.experienceId}`);
    return { ok: true, tags };
  } catch (error) {
    return mapExperienceError(error);
  }
}

export async function removeExperienceTagAction(input: {
  experienceId: string;
  tagId: string;
}): Promise<ExperienceMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    const result = await removeTagFromExperience(
      input.experienceId,
      input.tagId,
    );
    if (result === "experience_not_found") {
      return {
        ok: false,
        code: "not_found",
        message: "Experience not found.",
      };
    }
    if (result === "tag_not_assigned") {
      return {
        ok: false,
        code: "not_found",
        message: "Tag is not assigned to this experience.",
      };
    }
  } catch (error) {
    return mapExperienceError(error);
  }

  safeRevalidatePath(`/admin/experiences/${input.experienceId}`);
  return { ok: true };
}
