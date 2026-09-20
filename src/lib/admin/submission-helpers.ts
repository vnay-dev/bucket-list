import type { SubmissionStatus } from "@/lib/submissions/validation";

export const SUBMISSION_STATUSES: SubmissionStatus[] = [
  "pending",
  "approved",
  "rejected",
];

export function parseSubmissionStatusFilter(
  value: string | string[] | undefined,
): SubmissionStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "approved" || raw === "rejected" || raw === "pending") {
    return raw;
  }
  return "pending";
}

export function formatSubmissionStatus(status: SubmissionStatus): string {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

export function suggestExperienceTitle(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0]?.trim() || content.trim();
  if (firstLine.length <= 200) {
    return firstLine;
  }
  return firstLine.slice(0, 200);
}

export type SubmissionActionNotice =
  | "approved"
  | "merged"
  | "rejected"
  | "already_processed"
  | "error";

export function parseSubmissionNotice(
  value: string | string[] | undefined,
): SubmissionActionNotice | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "approved" ||
    raw === "merged" ||
    raw === "rejected" ||
    raw === "already_processed" ||
    raw === "error"
  ) {
    return raw;
  }
  return null;
}

export function submissionNoticeMessage(
  notice: SubmissionActionNotice,
): string {
  switch (notice) {
    case "approved":
      return "Submission approved. A new experience was published.";
    case "merged":
      return "Submission merged into an existing experience.";
    case "rejected":
      return "Submission rejected. It remains available in the rejected filter.";
    case "already_processed":
      return "That submission was already processed and is no longer pending.";
    case "error":
      return "Something went wrong while updating the submission. Try again.";
  }
}
