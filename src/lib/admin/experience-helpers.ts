export type ExperienceActionNotice =
  | "created"
  | "updated"
  | "deleted"
  | "error";

export function parseExperienceNotice(
  value: string | string[] | undefined,
): ExperienceActionNotice | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "created" ||
    raw === "updated" ||
    raw === "deleted" ||
    raw === "error"
  ) {
    return raw;
  }
  return null;
}

export function experienceNoticeMessage(
  notice: ExperienceActionNotice,
): string {
  switch (notice) {
    case "created":
      return "Experience created.";
    case "updated":
      return "Experience saved.";
    case "deleted":
      return "Experience deleted.";
    case "error":
      return "Something went wrong. Try again.";
  }
}

export function parsePlaceFilter(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === "all") {
    return undefined;
  }
  return raw.trim() || undefined;
}

export function parseTagFilter(
  value: string | string[] | undefined,
): string | undefined {
  return parsePlaceFilter(value);
}

export function parseSearchQuery(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
