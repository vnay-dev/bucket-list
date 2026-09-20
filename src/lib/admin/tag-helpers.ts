export type TagActionNotice =
  | "created"
  | "updated"
  | "deleted"
  | "error";

export function parseTagNotice(
  value: string | string[] | undefined,
): TagActionNotice | null {
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

export function tagNoticeMessage(notice: TagActionNotice): string {
  switch (notice) {
    case "created":
      return "Tag created.";
    case "updated":
      return "Tag renamed.";
    case "deleted":
      return "Tag deleted.";
    case "error":
      return "Something went wrong. Try again.";
  }
}

export function parseSearchQuery(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}
