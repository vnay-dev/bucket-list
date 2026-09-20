import { inArray } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { experience, experienceTag, place, tag } from "@/db/schema";
import { experienceTagPairKey } from "./select";
import type {
  EntityAction,
  ExistingState,
  ExperienceRow,
  ExperienceTagRow,
  PlaceRow,
  PlannedExperience,
  PlannedExperienceTag,
  PlannedPlace,
  PlannedTag,
  PromotionConflict,
  PromotionCounts,
  PromotionPayload,
  PromotionPlan,
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

export async function loadExistingState(
  productionDb: AnyDb,
  payload: PromotionPayload,
): Promise<ExistingState> {
  const placeIds = payload.places.map((row) => row.id);
  const placeSlugs = payload.places.map((row) => row.slug);
  const experienceIds = payload.experiences.map((row) => row.id);
  const tagIds = payload.tags.map((row) => row.id);
  const tagNames = payload.tags.map((row) => row.name);

  const placesById = new Map<string, PlaceRow>();
  const placesBySlug = new Map<string, PlaceRow>();
  const experiencesById = new Map<string, ExperienceRow>();
  const tagsById = new Map<string, TagRow>();
  const tagsByName = new Map<string, TagRow>();
  const experienceTagsByPair = new Map<string, ExperienceTagRow>();

  if (placeIds.length > 0) {
    const byId = await productionDb
      .select()
      .from(place)
      .where(inArray(place.id, placeIds));
    for (const row of byId) {
      placesById.set(row.id, toPlaceRow(row));
    }
  }

  if (placeSlugs.length > 0) {
    const bySlug = await productionDb
      .select()
      .from(place)
      .where(inArray(place.slug, placeSlugs));
    for (const row of bySlug) {
      placesBySlug.set(row.slug, toPlaceRow(row));
    }
  }

  if (experienceIds.length > 0) {
    const rows = await productionDb
      .select()
      .from(experience)
      .where(inArray(experience.id, experienceIds));
    for (const row of rows) {
      experiencesById.set(row.id, toExperienceRow(row));
    }
  }

  if (tagIds.length > 0) {
    const byId = await productionDb
      .select()
      .from(tag)
      .where(inArray(tag.id, tagIds));
    for (const row of byId) {
      tagsById.set(row.id, toTagRow(row));
    }
  }

  if (tagNames.length > 0) {
    const byName = await productionDb
      .select()
      .from(tag)
      .where(inArray(tag.name, tagNames));
    for (const row of byName) {
      tagsByName.set(row.name, toTagRow(row));
    }
  }

  if (experienceIds.length > 0) {
    const rows = await productionDb
      .select()
      .from(experienceTag)
      .where(inArray(experienceTag.experienceId, experienceIds));
    for (const row of rows) {
      experienceTagsByPair.set(
        experienceTagPairKey(row.experienceId, row.tagId),
        toExperienceTagRow(row),
      );
    }
  }

  return {
    placesById,
    placesBySlug,
    experiencesById,
    tagsById,
    tagsByName,
    experienceTagsByPair,
  };
}

function placesEqual(a: PlaceRow, b: PlaceRow): boolean {
  return (
    a.name === b.name &&
    a.slug === b.slug &&
    a.city === b.city &&
    a.state === b.state &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude
  );
}

function experiencesEqual(a: ExperienceRow, b: ExperienceRow): boolean {
  return (
    a.placeId === b.placeId &&
    a.title === b.title &&
    a.description === b.description &&
    a.goodToKnow === b.goodToKnow
  );
}

function tagsEqual(a: TagRow, b: TagRow): boolean {
  return a.name === b.name;
}

function placeAction(incoming: PlaceRow, existing: PlaceRow | undefined): EntityAction {
  if (!existing) {
    return "create";
  }
  return placesEqual(incoming, existing) ? "unchanged" : "update";
}

function experienceAction(
  incoming: ExperienceRow,
  existing: ExperienceRow | undefined,
): EntityAction {
  if (!existing) {
    return "create";
  }
  return experiencesEqual(incoming, existing) ? "unchanged" : "update";
}

function tagAction(incoming: TagRow, existing: TagRow | undefined): EntityAction {
  if (!existing) {
    return "create";
  }
  return tagsEqual(incoming, existing) ? "unchanged" : "update";
}

/**
 * Validates relationships and Production conflicts, then builds an idempotent plan.
 * Pure aside from using the preloaded ExistingState — safe to unit test.
 */
export function buildPromotionPlan(
  payload: PromotionPayload,
  existing: ExistingState,
): PromotionPlan {
  const conflicts: PromotionConflict[] = [];

  const placeIds = new Set(payload.places.map((row) => row.id));
  const experienceIds = new Set(payload.experiences.map((row) => row.id));
  const tagIds = new Set(payload.tags.map((row) => row.id));

  for (const exp of payload.experiences) {
    if (!placeIds.has(exp.placeId)) {
      conflicts.push({
        code: "missing_place",
        message: `Experience ${exp.id} references place ${exp.placeId}, which was not found in QA among approved content.`,
      });
    }
  }

  for (const link of payload.experienceTags) {
    if (!experienceIds.has(link.experienceId)) {
      conflicts.push({
        code: "missing_experience",
        message: `ExperienceTag ${link.id} references experience ${link.experienceId}, which is not in the promotion set.`,
      });
    }
    if (!tagIds.has(link.tagId)) {
      conflicts.push({
        code: "missing_tag",
        message: `ExperienceTag ${link.id} references tag ${link.tagId}, which was not found in QA among approved content.`,
      });
    }
  }

  for (const incoming of payload.places) {
    const bySlug = existing.placesBySlug.get(incoming.slug);
    if (bySlug && bySlug.id !== incoming.id) {
      conflicts.push({
        code: "place_slug_id_mismatch",
        message: `Place slug "${incoming.slug}" exists in Production as ${bySlug.id}, but QA place id is ${incoming.id}.`,
      });
    }

    const byId = existing.placesById.get(incoming.id);
    if (byId && byId.slug !== incoming.slug) {
      const other = existing.placesBySlug.get(incoming.slug);
      if (other && other.id !== incoming.id) {
        conflicts.push({
          code: "place_slug_collision",
          message: `Updating Production place ${incoming.id} to slug "${incoming.slug}" would collide with place ${other.id}.`,
        });
      }
    }
  }

  for (const incoming of payload.tags) {
    const byName = existing.tagsByName.get(incoming.name);
    if (byName && byName.id !== incoming.id) {
      conflicts.push({
        code: "tag_name_id_mismatch",
        message: `Tag name "${incoming.name}" exists in Production as ${byName.id}, but QA tag id is ${incoming.id}.`,
      });
    }

    const byId = existing.tagsById.get(incoming.id);
    if (byId && byId.name !== incoming.name) {
      const other = existing.tagsByName.get(incoming.name);
      if (other && other.id !== incoming.id) {
        conflicts.push({
          code: "tag_name_collision",
          message: `Updating Production tag ${incoming.id} to name "${incoming.name}" would collide with tag ${other.id}.`,
        });
      }
    }
  }

  const places: PlannedPlace[] = payload.places.map((row) => ({
    row,
    action: placeAction(row, existing.placesById.get(row.id)),
  }));

  const tags: PlannedTag[] = payload.tags.map((row) => ({
    row,
    action: tagAction(row, existing.tagsById.get(row.id)),
  }));

  const experiences: PlannedExperience[] = payload.experiences.map((row) => ({
    row,
    action: experienceAction(row, existing.experiencesById.get(row.id)),
  }));

  const experienceTags: PlannedExperienceTag[] = payload.experienceTags.map(
    (row) => {
      const key = experienceTagPairKey(row.experienceId, row.tagId);
      const existingLink = existing.experienceTagsByPair.get(key);
      return {
        row,
        action: existingLink ? "unchanged" : "create",
      };
    },
  );

  return {
    places,
    experiences,
    tags,
    experienceTags,
    conflicts,
  };
}

export function countPlanActions(plan: PromotionPlan): PromotionCounts {
  return {
    placesCreated: plan.places.filter((item) => item.action === "create").length,
    placesUpdated: plan.places.filter((item) => item.action === "update").length,
    experiencesCreated: plan.experiences.filter((item) => item.action === "create")
      .length,
    experiencesUpdated: plan.experiences.filter((item) => item.action === "update")
      .length,
    tagsCreated: plan.tags.filter((item) => item.action === "create").length,
    tagsUpdated: plan.tags.filter((item) => item.action === "update").length,
    relationshipsAdded: plan.experienceTags.filter((item) => item.action === "create")
      .length,
  };
}

export function planHasConflicts(plan: PromotionPlan): boolean {
  return plan.conflicts.length > 0;
}
