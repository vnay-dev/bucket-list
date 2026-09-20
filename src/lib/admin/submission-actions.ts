"use server";

import { redirect } from "next/navigation";
import { requireCurator } from "@/lib/auth/authenticated-user";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  ExperienceRepositoryError,
  createExperience,
} from "@/lib/experiences/repository";
import {
  SubmissionRepositoryError,
  approveSubmission,
  getSubmissionById,
  mergeSubmission,
  rejectSubmission,
} from "@/lib/submissions/repository";

export type SubmissionMutationResult =
  | { ok: true; notice: "approved" | "merged" | "rejected" }
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

function mapAuthError(error: unknown): SubmissionMutationResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function mapSubmissionError(error: unknown): SubmissionMutationResult {
  if (error instanceof SubmissionRepositoryError) {
    if (error.code === "submission_not_found") {
      return { ok: false, code: "not_found", message: "Submission not found." };
    }
    if (error.code === "experience_not_found") {
      return { ok: false, code: "not_found", message: "Experience not found." };
    }
    if (error.code === "place_not_found") {
      return { ok: false, code: "not_found", message: "Place not found." };
    }
    if (error.code === "invalid_state") {
      return {
        ok: false,
        code: "conflict",
        message: "This submission is no longer pending.",
      };
    }
  }

  if (error instanceof ExperienceRepositoryError) {
    if (error.code === "place_not_found") {
      return { ok: false, code: "not_found", message: "Place not found." };
    }
  }

  return {
    ok: false,
    code: "error",
    message: "Unable to update the submission. Please try again.",
  };
}

function redirectAfterSuccess(notice: "approved" | "merged" | "rejected"): never {
  redirect(`/admin/submissions?status=pending&notice=${notice}`);
}

export async function approveEditedSubmissionAction(input: {
  submissionId: string;
  title: string;
  description: string;
  goodToKnow: string;
  placeId: string;
}): Promise<SubmissionMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

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

  if (!description) {
    fieldErrors.description = "Description is required.";
  } else if (description.length > 10_000) {
    fieldErrors.description = "Description must be at most 10000 characters.";
  }

  if (goodToKnow.length > 10_000) {
    fieldErrors.goodToKnow = "Good to know must be at most 10000 characters.";
  }

  if (!placeId) {
    fieldErrors.placeId = "Place is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    const existing = await getSubmissionById(input.submissionId);
    if (!existing) {
      return {
        ok: false,
        code: "not_found",
        message: "Submission not found.",
      };
    }
    if (existing.status !== "pending") {
      return {
        ok: false,
        code: "conflict",
        message: "This submission is no longer pending.",
      };
    }

    const created = await createExperience({
      placeId,
      title,
      description,
      goodToKnow: goodToKnow.length > 0 ? goodToKnow : null,
    });

    await approveSubmission(input.submissionId, {
      experienceId: created.id,
    });
  } catch (error) {
    return mapSubmissionError(error);
  }

  redirectAfterSuccess("approved");
}

export async function mergeSubmissionAction(input: {
  submissionId: string;
  experienceId: string;
}): Promise<SubmissionMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!input.experienceId.trim()) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Select an experience to merge into.",
    };
  }

  try {
    await mergeSubmission(input.submissionId, {
      experienceId: input.experienceId.trim(),
    });
  } catch (error) {
    return mapSubmissionError(error);
  }

  redirectAfterSuccess("merged");
}

export async function rejectSubmissionAction(input: {
  submissionId: string;
}): Promise<SubmissionMutationResult> {
  try {
    await requireCurator();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  try {
    await rejectSubmission(input.submissionId);
  } catch (error) {
    return mapSubmissionError(error);
  }

  redirectAfterSuccess("rejected");
}
