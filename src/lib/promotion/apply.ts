import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { experience, experienceTag, place, tag } from "@/db/schema";
import type { PromotionCounts, PromotionPlan } from "./types";

/**
 * Applies a validated promotion plan to Production inside a single transaction.
 * Preserves QA primary keys so FK relationships stay intact.
 */
export async function applyPromotionPlan(
  productionDatabaseUrl: string,
  plan: PromotionPlan,
): Promise<PromotionCounts> {
  const pool = new Pool({ connectionString: productionDatabaseUrl });
  const db = drizzle(pool);

  try {
    return await db.transaction(async (tx) => {
      let placesCreated = 0;
      let placesUpdated = 0;
      let experiencesCreated = 0;
      let experiencesUpdated = 0;
      let tagsCreated = 0;
      let tagsUpdated = 0;
      let relationshipsAdded = 0;

      for (const item of plan.places) {
        if (item.action === "unchanged") {
          continue;
        }

        await tx
          .insert(place)
          .values({
            id: item.row.id,
            name: item.row.name,
            slug: item.row.slug,
            city: item.row.city,
            state: item.row.state,
            latitude: item.row.latitude,
            longitude: item.row.longitude,
          })
          .onConflictDoUpdate({
            target: place.id,
            set: {
              name: item.row.name,
              slug: item.row.slug,
              city: item.row.city,
              state: item.row.state,
              latitude: item.row.latitude,
              longitude: item.row.longitude,
            },
          });

        if (item.action === "create") {
          placesCreated += 1;
        } else {
          placesUpdated += 1;
        }
      }

      for (const item of plan.tags) {
        if (item.action === "unchanged") {
          continue;
        }

        await tx
          .insert(tag)
          .values({
            id: item.row.id,
            name: item.row.name,
          })
          .onConflictDoUpdate({
            target: tag.id,
            set: {
              name: item.row.name,
            },
          });

        if (item.action === "create") {
          tagsCreated += 1;
        } else {
          tagsUpdated += 1;
        }
      }

      for (const item of plan.experiences) {
        if (item.action === "unchanged") {
          continue;
        }

        await tx
          .insert(experience)
          .values({
            id: item.row.id,
            placeId: item.row.placeId,
            title: item.row.title,
            description: item.row.description,
            goodToKnow: item.row.goodToKnow,
            createdAt: item.row.createdAt,
            updatedAt: item.row.updatedAt,
          })
          .onConflictDoUpdate({
            target: experience.id,
            set: {
              placeId: item.row.placeId,
              title: item.row.title,
              description: item.row.description,
              goodToKnow: item.row.goodToKnow,
              updatedAt: item.row.updatedAt,
            },
          });

        if (item.action === "create") {
          experiencesCreated += 1;
        } else {
          experiencesUpdated += 1;
        }
      }

      for (const item of plan.experienceTags) {
        if (item.action === "unchanged") {
          continue;
        }

        await tx
          .insert(experienceTag)
          .values({
            id: item.row.id,
            experienceId: item.row.experienceId,
            tagId: item.row.tagId,
          })
          .onConflictDoNothing({
            target: [experienceTag.experienceId, experienceTag.tagId],
          });

        relationshipsAdded += 1;
      }

      return {
        placesCreated,
        placesUpdated,
        experiencesCreated,
        experiencesUpdated,
        tagsCreated,
        tagsUpdated,
        relationshipsAdded,
      };
    });
  } finally {
    await pool.end();
  }
}

/**
 * Test-friendly apply that uses an injected transactional runner.
 * On thrown errors, the runner must roll back so Production is unchanged.
 */
export type TransactionalWriter = {
  applyPlan(plan: PromotionPlan): Promise<PromotionCounts>;
};
