export type TeamActionNotice =
  | "curator_added"
  | "role_updated"
  | "access_removed"
  | "error";

export function parseTeamNotice(
  value: string | string[] | undefined,
): TeamActionNotice | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "curator_added" ||
    raw === "role_updated" ||
    raw === "access_removed" ||
    raw === "error"
  ) {
    return raw;
  }
  return null;
}

export function teamNoticeMessage(notice: TeamActionNotice): string {
  switch (notice) {
    case "curator_added":
      return "Curator access granted.";
    case "role_updated":
      return "Role updated.";
    case "access_removed":
      return "Admin access removed.";
    case "error":
      return "Something went wrong. Try again.";
  }
}

export function parseEmailQuery(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmailFormat(value: string): boolean {
  const email = normalizeEmailInput(value);
  // Practical format check — not a full RFC validator.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
