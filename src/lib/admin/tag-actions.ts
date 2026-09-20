"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurator } from "@/lib/auth/authenticated-user";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  TagRepositoryError,
  createTag,
  deleteTagById,
  updateTagById,
} from "@/lib/tags/repository";
import { validateTagNameInput } from "@/lib/tags/validation";

export type TagMutationResult =
  | { ok: true; tagId?: string; name?: string }
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

function mapAuthError(error: unknown): TagMutationResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function mapTagError(error: unknown): TagMutationResult {
  if (error instanceof TagRepositoryError) {
    if (error.code === "duplicate_name") {
      return {
        ok: false,
        code: "conflict",
        message: "A tag with this name already exists.",
        fieldErrors: { name: "A tag with this name already exists." },
      };
    }
  }

  return {
    ok: false,
    code: "error",
    message: "Unable to update the tag. Please try again.",
  };
}

function redirectCreated(): never {
  redirect("/admin/tags?notice=created");
}

function redirectUpdated(): never {
  redirect("/admin/tags?notice=updated");
}

function redirectDeleted(): never {
  redirect("/admin/tags?notice=deleted");
}

export async function createTagAction(input: {
  name: string;
}): Promise<TagMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const validation = validateTagNameInput(input);
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors: validation.details,
    };
  }

  try {
    await createTag(validation.data);
  } catch (error) {
    return mapTagError(error);
  }

  safeRevalidatePath("/admin/tags");
  safeRevalidatePath("/admin/experiences");
  redirectCreated();
}

export async function updateTagAction(input: {
  tagId: string;
  name: string;
}): Promise<TagMutationResult> {
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
      message: "Tag is required.",
    };
  }

  const validation = validateTagNameInput({ name: input.name });
  if (!validation.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors: validation.details,
    };
  }

  try {
    const updated = await updateTagById(input.tagId, validation.data);
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "Tag not found.",
      };
    }
  } catch (error) {
    return mapTagError(error);
  }

  safeRevalidatePath("/admin/tags");
  safeRevalidatePath("/admin/experiences");
  redirectUpdated();
}

export async function deleteTagAction(input: {
  tagId: string;
}): Promise<TagMutationResult> {
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
      message: "Tag is required.",
    };
  }

  try {
    const deleted = await deleteTagById(input.tagId);
    if (!deleted) {
      return {
        ok: false,
        code: "not_found",
        message: "Tag not found.",
      };
    }
  } catch (error) {
    return mapTagError(error);
  }

  safeRevalidatePath("/admin/tags");
  safeRevalidatePath("/admin/experiences");
  redirectDeleted();
}
