import { and, asc, count, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { experienceTag, tag } from "@/db/schema";

export type TagListItem = {
  id: string;
  name: string;
  experienceCount: number;
};

export async function listAdminTags(options: {
  query?: string;
}): Promise<TagListItem[]> {
  const filters = [];

  if (options.query) {
    filters.push(ilike(tag.name, `%${options.query}%`));
  }

  const rows = await db
    .select({
      id: tag.id,
      name: tag.name,
      experienceCount: sql<number>`coalesce(${count(experienceTag.id)}, 0)`.mapWith(
        Number,
      ),
    })
    .from(tag)
    .leftJoin(experienceTag, eq(experienceTag.tagId, tag.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .groupBy(tag.id)
    .orderBy(asc(tag.name));

  return rows;
}
