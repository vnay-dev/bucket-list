import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { experience, place, submission } from "@/db/schema";
import type { ExperienceRecord } from "@/lib/experiences/repository";
import { listExperiences } from "@/lib/experiences/repository";
import type { PlaceRecord } from "@/lib/places/repository";
import { listPlaces } from "@/lib/places/repository";
import type { SubmissionRecord } from "@/lib/submissions/repository";
import { getSubmissionById } from "@/lib/submissions/repository";
import type { SubmissionStatus } from "@/lib/submissions/validation";

export type SubmissionListItem = {
  id: string;
  content: string;
  goodToKnow: string | null;
  status: SubmissionStatus;
  createdAt: Date;
  placeName: string;
  placeLocation: string;
};

export type SubmissionReviewData = {
  submission: SubmissionRecord;
  place: PlaceRecord;
  places: PlaceRecord[];
  experiences: ExperienceRecord[];
  linkedExperience: ExperienceRecord | null;
};

/**
 * Lists submissions for the admin queue, joined with place display fields.
 * Ordered oldest-first for a predictable moderation queue.
 */
export async function listAdminSubmissions(
  status: SubmissionStatus,
): Promise<SubmissionListItem[]> {
  const rows = await db
    .select({
      id: submission.id,
      content: submission.content,
      goodToKnow: submission.goodToKnow,
      status: submission.status,
      createdAt: submission.createdAt,
      placeName: place.name,
      placeCity: place.city,
      placeState: place.state,
    })
    .from(submission)
    .innerJoin(place, eq(submission.placeId, place.id))
    .where(eq(submission.status, status))
    .orderBy(asc(submission.createdAt));

  return rows.map((row) => {
    if (
      row.status !== "pending" &&
      row.status !== "approved" &&
      row.status !== "rejected"
    ) {
      throw new Error(`Unexpected submission status: ${row.status}`);
    }

    return {
      id: row.id,
      content: row.content,
      goodToKnow: row.goodToKnow,
      status: row.status,
      createdAt: row.createdAt,
      placeName: row.placeName,
      placeLocation: `${row.placeCity}, ${row.placeState}`,
    };
  });
}

export async function getSubmissionReviewData(
  id: string,
): Promise<SubmissionReviewData | null> {
  const record = await getSubmissionById(id);
  if (!record) {
    return null;
  }

  const [placeRow] = await db
    .select()
    .from(place)
    .where(eq(place.id, record.placeId))
    .limit(1);

  if (!placeRow) {
    return null;
  }

  const places = await listPlaces();
  const experiences = await listExperiences();

  let linkedExperience: ExperienceRecord | null = null;
  if (record.experienceId) {
    linkedExperience =
      experiences.find((item) => item.id === record.experienceId) ?? null;

    if (!linkedExperience) {
      const [experienceRow] = await db
        .select()
        .from(experience)
        .where(eq(experience.id, record.experienceId))
        .limit(1);

      if (experienceRow) {
        linkedExperience = {
          id: experienceRow.id,
          placeId: experienceRow.placeId,
          title: experienceRow.title,
          description: experienceRow.description,
          goodToKnow: experienceRow.goodToKnow,
          createdAt: experienceRow.createdAt,
          updatedAt: experienceRow.updatedAt,
          tags: [],
        };
      }
    }
  }

  return {
    submission: record,
    place: {
      id: placeRow.id,
      name: placeRow.name,
      slug: placeRow.slug,
      city: placeRow.city,
      state: placeRow.state,
      latitude: placeRow.latitude,
      longitude: placeRow.longitude,
    },
    places,
    experiences,
    linkedExperience,
  };
}
