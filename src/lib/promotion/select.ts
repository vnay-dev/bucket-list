import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { experience, experienceTag, place, submission, tag } from "@/db/schema";
import type {
  ExperienceRow,
  ExperienceTagRow,
  PlaceRow,
  PromotionPayload,
  TagRow,
} from "./types";

type AnyDb = NeonHttpDatabase<Record<string, unknown>>;

function toPlaceRow(row: typeof place.$inferSelect): PlaceRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function toExperienceRow(row: typeof experience.$inferSelect): ExperienceRow {
  return {
    id: row.id,
    placeId: row.placeId,
    title: row.title,
    description: row.description,
    goodToKnow: row.goodToKnow,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTagRow(row: typeof tag.$inferSelect): TagRow {
  return {
    id: row.id,
    name: row.name,
  };
}

function toExperienceTagRow(
  row: typeof experienceTag.$inferSelect,
): ExperienceTagRow {
  return {
    id: row.id,
    experienceId: row.experienceId,
    tagId: row.tagId,
  };
}

/**
 * Selects production-ready curated content from QA.
 * Signal: Submission.status === "approved" with a linked experience_id.
 * Does not include Users, Wishlists, or Submissions themselves.
 */
export async function selectApprovedContent(
  qaDb: AnyDb,
): Promise<PromotionPayload> {
  const approvedRows = await qaDb
    .select({
      experienceId: submission.experienceId,
    })
    .from(submission)
    .where(
      and(eq(submission.status, "approved"), isNotNull(submission.experienceId)),
    );

  const approvedSubmissionCount = approvedRows.length;
  const experienceIds = [
    ...new Set(
      approvedRows
        .map((row) => row.experienceId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (experienceIds.length === 0) {
    return {
      places: [],
      experiences: [],
      tags: [],
      experienceTags: [],
      approvedSubmissionCount,
    };
  }

  const experienceRows = await qaDb
    .select()
    .from(experience)
    .where(inArray(experience.id, experienceIds));

  const placeIds = [
    ...new Set(experienceRows.map((row) => row.placeId)),
  ];

  const placeRows =
    placeIds.length > 0
      ? await qaDb.select().from(place).where(inArray(place.id, placeIds))
      : [];

  const experienceTagRows = await qaDb
    .select()
    .from(experienceTag)
    .where(inArray(experienceTag.experienceId, experienceIds));

  const tagIds = [...new Set(experienceTagRows.map((row) => row.tagId))];

  const tagRows =
    tagIds.length > 0
      ? await qaDb.select().from(tag).where(inArray(tag.id, tagIds))
      : [];

  return {
    places: placeRows.map(toPlaceRow),
    experiences: experienceRows.map(toExperienceRow),
    tags: tagRows.map(toTagRow),
    experienceTags: experienceTagRows.map(toExperienceTagRow),
    approvedSubmissionCount,
  };
}

export function experienceTagPairKey(
  experienceId: string,
  tagId: string,
): string {
  return `${experienceId}::${tagId}`;
}
