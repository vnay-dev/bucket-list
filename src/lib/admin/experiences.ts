import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { experience, experienceTag, place, tag } from "@/db/schema";
import type { ExperienceRecord } from "@/lib/experiences/repository";
import { getExperienceById } from "@/lib/experiences/repository";
import type { PlaceRecord } from "@/lib/places/repository";
import { listPlaces } from "@/lib/places/repository";
import { listTags, type TagRecord } from "@/lib/tags/repository";

export type ExperienceListItem = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: Date;
  placeName: string;
  placeLocation: string;
  tags: TagRecord[];
};

export type ExperienceEditorData = {
  experience: ExperienceRecord;
  places: PlaceRecord[];
  allTags: TagRecord[];
};

export type ExperienceCreateData = {
  places: PlaceRecord[];
  allTags: TagRecord[];
};

export async function listAdminExperiences(options: {
  query?: string;
  placeId?: string;
  tagId?: string;
}): Promise<ExperienceListItem[]> {
  const filters = [];

  if (options.placeId) {
    filters.push(eq(experience.placeId, options.placeId));
  }

  if (options.query) {
    filters.push(ilike(experience.title, `%${options.query}%`));
  }

  if (options.tagId) {
    const tagged = await db
      .select({ experienceId: experienceTag.experienceId })
      .from(experienceTag)
      .where(eq(experienceTag.tagId, options.tagId));

    if (tagged.length === 0) {
      return [];
    }

    filters.push(
      inArray(
        experience.id,
        tagged.map((row) => row.experienceId),
      ),
    );
  }

  const rows = await db
    .select({
      id: experience.id,
      title: experience.title,
      description: experience.description,
      updatedAt: experience.updatedAt,
      placeName: place.name,
      placeCity: place.city,
      placeState: place.state,
    })
    .from(experience)
    .innerJoin(place, eq(experience.placeId, place.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(asc(experience.title));

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const tagRows = await db
    .select({
      experienceId: experienceTag.experienceId,
      id: tag.id,
      name: tag.name,
    })
    .from(experienceTag)
    .innerJoin(tag, eq(experienceTag.tagId, tag.id))
    .where(inArray(experienceTag.experienceId, ids))
    .orderBy(asc(tag.name));

  const tagsByExperience = new Map<string, TagRecord[]>();
  for (const row of tagRows) {
    const list = tagsByExperience.get(row.experienceId) ?? [];
    list.push({ id: row.id, name: row.name });
    tagsByExperience.set(row.experienceId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    updatedAt: row.updatedAt,
    placeName: row.placeName,
    placeLocation: `${row.placeCity}, ${row.placeState}`,
    tags: tagsByExperience.get(row.id) ?? [],
  }));
}

export async function getExperienceEditorData(
  id: string,
): Promise<ExperienceEditorData | null> {
  const record = await getExperienceById(id);
  if (!record) {
    return null;
  }

  const [places, allTags] = await Promise.all([listPlaces(), listTags()]);

  return {
    experience: record,
    places,
    allTags,
  };
}

export async function getExperienceCreateData(): Promise<ExperienceCreateData> {
  const [places, allTags] = await Promise.all([listPlaces(), listTags()]);
  return { places, allTags };
}
