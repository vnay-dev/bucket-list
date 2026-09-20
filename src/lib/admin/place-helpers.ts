export type PlaceActionNotice =
  | "created"
  | "updated"
  | "deleted"
  | "error";

export function parsePlaceNotice(
  value: string | string[] | undefined,
): PlaceActionNotice | null {
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

export function placeNoticeMessage(notice: PlaceActionNotice): string {
  switch (notice) {
    case "created":
      return "Place created.";
    case "updated":
      return "Place saved.";
    case "deleted":
      return "Place deleted.";
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

export function parseCityFilter(
  value: string | string[] | undefined,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

export function formatCoordinates(
  latitude: number,
  longitude: number,
): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
