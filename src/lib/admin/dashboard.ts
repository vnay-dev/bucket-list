import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { experience, place, submission, tag } from "@/db/schema";

export type DashboardCounts = {
  pendingSubmissions: number;
  experiences: number;
  places: number;
  tags: number;
};

export type PendingSubmissionSummary = {
  id: string;
  content: string;
  createdAt: Date;
  placeName: string;
  placeLocation: string;
};

export type DashboardOverview = {
  counts: DashboardCounts;
  pendingSubmissions: PendingSubmissionSummary[];
};

const PENDING_PREVIEW_LIMIT = 8;

/**
 * Loads live dashboard metrics and a short pending-submissions queue
 * for the admin home. Uses the database directly (server-side only).
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const [
    [pendingCountRow],
    [experienceCountRow],
    [placeCountRow],
    [tagCountRow],
    pendingRows,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(submission)
      .where(eq(submission.status, "pending")),
    db.select({ value: count() }).from(experience),
    db.select({ value: count() }).from(place),
    db.select({ value: count() }).from(tag),
    db
      .select({
        id: submission.id,
        content: submission.content,
        createdAt: submission.createdAt,
        placeName: place.name,
        placeCity: place.city,
        placeState: place.state,
      })
      .from(submission)
      .innerJoin(place, eq(submission.placeId, place.id))
      .where(eq(submission.status, "pending"))
      .orderBy(asc(submission.createdAt))
      .limit(PENDING_PREVIEW_LIMIT),
  ]);

  return {
    counts: {
      pendingSubmissions: pendingCountRow?.value ?? 0,
      experiences: experienceCountRow?.value ?? 0,
      places: placeCountRow?.value ?? 0,
      tags: tagCountRow?.value ?? 0,
    },
    pendingSubmissions: pendingRows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      placeName: row.placeName,
      placeLocation: `${row.placeCity}, ${row.placeState}`,
    })),
  };
}
