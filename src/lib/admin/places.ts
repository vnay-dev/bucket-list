import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { experience, place } from "@/db/schema";
import {
  getPlaceBySlug,
  type PlaceRecord,
} from "@/lib/places/repository";

export type PlaceListItem = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  experienceCount: number;
};

export type PlaceEditorData = {
  place: PlaceRecord;
  experienceCount: number;
};

export async function listAdminPlaces(options: {
  query?: string;
  city?: string;
}): Promise<PlaceListItem[]> {
  const filters = [];

  if (options.query) {
    filters.push(ilike(place.name, `%${options.query}%`));
  }

  if (options.city) {
    filters.push(ilike(place.city, `%${options.city}%`));
  }

  const rows = await db
    .select({
      id: place.id,
      name: place.name,
      slug: place.slug,
      city: place.city,
      state: place.state,
      latitude: place.latitude,
      longitude: place.longitude,
      experienceCount: sql<number>`coalesce(${count(experience.id)}, 0)`.mapWith(
        Number,
      ),
    })
    .from(place)
    .leftJoin(experience, eq(experience.placeId, place.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .groupBy(place.id)
    .orderBy(asc(place.name));

  return rows;
}

export async function getPlaceEditorData(
  slug: string,
): Promise<PlaceEditorData | null> {
  const record = await getPlaceBySlug(slug);
  if (!record) {
    return null;
  }

  const [countRow] = await db
    .select({
      experienceCount: sql<number>`coalesce(${count(experience.id)}, 0)`.mapWith(
        Number,
      ),
    })
    .from(experience)
    .where(eq(experience.placeId, record.id));

  return {
    place: record,
    experienceCount: countRow?.experienceCount ?? 0,
  };
}
