import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { experience, experienceTag, place, tag, user } from "../src/db/schema";
import {
  resetAuthenticatedUserResolver,
  setAuthenticatedUserResolver,
} from "../src/lib/auth/authenticated-user";
import {
  assignExperienceTagAction,
  createExperienceAction,
  deleteExperienceAction,
  removeExperienceTagAction,
  updateExperienceAction,
} from "../src/lib/admin/experience-actions";
import {
  parseExperienceNotice,
  parsePlaceFilter,
  parseSearchQuery,
} from "../src/lib/admin/experience-helpers";
import { listAdminExperiences } from "../src/lib/admin/experiences";
import { listTags } from "../src/lib/tags/repository";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

describe("experience admin helpers", () => {
  it("parses search, place filter, and notices", () => {
    assert.equal(parseSearchQuery("  ridge  "), "ridge");
    assert.equal(parsePlaceFilter("all"), undefined);
    assert.equal(parsePlaceFilter("abc"), "abc");
    assert.equal(parseExperienceNotice("created"), "created");
    assert.equal(parseExperienceNotice("nope"), null);
  });
});

describe("experience admin list and tags catalog", () => {
  const suffix = Date.now().toString(36);
  const placeIds: string[] = [];
  const experienceIds: string[] = [];
  const tagIds: string[] = [];

  let placeAId = "";
  let placeBId = "";
  let tagAId = "";

  before(async () => {
    const places = await db
      .insert(place)
      .values([
        {
          name: "Exp Admin Place A",
          slug: `exp-admin-a-${suffix}`,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        },
        {
          name: "Exp Admin Place B",
          slug: `exp-admin-b-${suffix}`,
          city: "Durham",
          state: "NC",
          latitude: 35.994,
          longitude: -78.8986,
        },
      ])
      .returning();
    placeAId = places[0]!.id;
    placeBId = places[1]!.id;
    placeIds.push(placeAId, placeBId);

    const tags = await db
      .insert(tag)
      .values([
        { name: `exp-admin-tag-a-${suffix}` },
        { name: `exp-admin-tag-b-${suffix}` },
      ])
      .returning();
    tagAId = tags[0]!.id;
    tagIds.push(tags[0]!.id, tags[1]!.id);

    const created = await db
      .insert(experience)
      .values([
        {
          placeId: placeAId,
          title: `Ridge Walk ${suffix}`,
          description: "A long ridge trail",
          goodToKnow: "Bring water",
        },
        {
          placeId: placeBId,
          title: `City Garden ${suffix}`,
          description: "Quiet gardens",
          goodToKnow: null,
        },
      ])
      .returning();
    experienceIds.push(created[0]!.id, created[1]!.id);

    await db.insert(experienceTag).values({
      experienceId: created[0]!.id,
      tagId: tagAId,
    });
  });

  after(async () => {
    for (const id of experienceIds) {
      await db.delete(experienceTag).where(eq(experienceTag.experienceId, id));
      await db.delete(experience).where(eq(experience.id, id));
    }
    for (const id of tagIds) {
      await db.delete(tag).where(eq(tag.id, id));
    }
    for (const id of placeIds) {
      await db.delete(place).where(eq(place.id, id));
    }
  });

  it("lists experiences with place and tag context", async () => {
    const items = await listAdminExperiences({});
    const match = items.find((item) => item.id === experienceIds[0]);
    assert.ok(match);
    assert.equal(match.placeName, "Exp Admin Place A");
    assert.equal(match.placeLocation, "Asheville, NC");
    assert.ok(match.tags.some((item) => item.id === tagAId));
  });

  it("filters by title search and place", async () => {
    const byTitle = await listAdminExperiences({ query: `Ridge Walk ${suffix}` });
    assert.equal(byTitle.length, 1);
    assert.equal(byTitle[0]?.id, experienceIds[0]);

    const byPlace = await listAdminExperiences({ placeId: placeBId });
    assert.ok(byPlace.some((item) => item.id === experienceIds[1]));
    assert.equal(
      byPlace.some((item) => item.id === experienceIds[0]),
      false,
    );
  });

  it("lists all tags for the picker", async () => {
    const tags = await listTags();
    assert.ok(tags.some((item) => item.id === tagAId));
  });
});

describe("experience moderation actions", () => {
  const suffix = `${Date.now().toString(36)}-act`;
  const placeIds: string[] = [];
  const userIds: string[] = [];
  const experienceIds: string[] = [];
  const tagIds: string[] = [];

  let placeId = "";
  let userId = "";
  let tagId = "";

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Exp Action Curator",
        email: `exp-action-${suffix}@example.com`,
        role: "curator",
      })
      .returning();
    userId = seededUser.id;
    userIds.push(userId);

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Exp Action Place",
        slug: `exp-action-place-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeId = seededPlace.id;
    placeIds.push(placeId);

    const [seededTag] = await db
      .insert(tag)
      .values({ name: `exp-action-tag-${suffix}` })
      .returning();
    tagId = seededTag.id;
    tagIds.push(tagId);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `exp-action-${suffix}@example.com`,
      name: "Exp Action Curator",
      role: "curator",
    }));
  });

  after(async () => {
    resetAuthenticatedUserResolver();
    for (const id of experienceIds) {
      await db.delete(experienceTag).where(eq(experienceTag.experienceId, id));
      await db.delete(experience).where(eq(experience.id, id));
    }
    for (const id of tagIds) {
      await db.delete(tag).where(eq(tag.id, id));
    }
    for (const id of placeIds) {
      await db.delete(place).where(eq(place.id, id));
    }
    for (const id of userIds) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("rejects unauthenticated create attempts", async () => {
    setAuthenticatedUserResolver(async () => null);
    const result = await createExperienceAction({
      title: "Nope",
      description: "Nope",
      goodToKnow: "",
      placeId,
      tagIds: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unauthorized");
    }
    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `exp-action-${suffix}@example.com`,
      name: "Exp Action Curator",
      role: "curator",
    }));
  });

  it("returns validation errors for empty title", async () => {
    const result = await createExperienceAction({
      title: "  ",
      description: "Body",
      goodToKnow: "",
      placeId,
      tagIds: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_input");
      assert.ok(result.fieldErrors?.title);
    }
  });

  it("creates, updates, assigns tags, removes tags, and deletes", async () => {
    let createdId = "";

    try {
      await createExperienceAction({
        title: `Created Trail ${suffix}`,
        description: "Fresh description",
        goodToKnow: "Pack snacks",
        placeId,
        tagIds: [tagId],
      });
      assert.fail("expected redirect after create");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [created] = await db
      .select()
      .from(experience)
      .where(eq(experience.title, `Created Trail ${suffix}`))
      .limit(1);
    assert.ok(created);
    createdId = created.id;
    experienceIds.push(createdId);

    const assigned = await db
      .select()
      .from(experienceTag)
      .where(eq(experienceTag.experienceId, createdId));
    assert.equal(assigned.length, 1);

    const updateResult = await updateExperienceAction({
      experienceId: createdId,
      title: `Updated Trail ${suffix}`,
      description: "Updated description",
      goodToKnow: "",
      placeId,
    });
    assert.equal(updateResult.ok, true);

    const [updated] = await db
      .select()
      .from(experience)
      .where(eq(experience.id, createdId))
      .limit(1);
    assert.equal(updated.title, `Updated Trail ${suffix}`);
    assert.equal(updated.goodToKnow, null);

    const removeResult = await removeExperienceTagAction({
      experienceId: createdId,
      tagId,
    });
    assert.equal(removeResult.ok, true);

    const afterRemove = await db
      .select()
      .from(experienceTag)
      .where(eq(experienceTag.experienceId, createdId));
    assert.equal(afterRemove.length, 0);

    const addResult = await assignExperienceTagAction({
      experienceId: createdId,
      tagId,
    });
    assert.equal(addResult.ok, true);
    if (addResult.ok) {
      assert.ok(addResult.tags?.some((item) => item.id === tagId));
    }

    const duplicate = await assignExperienceTagAction({
      experienceId: createdId,
      tagId,
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.code, "conflict");
    }

    try {
      await deleteExperienceAction({ experienceId: createdId });
      assert.fail("expected redirect after delete");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [deleted] = await db
      .select()
      .from(experience)
      .where(eq(experience.id, createdId))
      .limit(1);
    assert.equal(deleted, undefined);
    experienceIds.pop();
  });

  it("forbids normal users from deleting experiences", async () => {
    const [created] = await db
      .insert(experience)
      .values({
        placeId,
        title: `Forbidden Delete ${suffix}`,
        description: "Stay",
        goodToKnow: null,
      })
      .returning();
    experienceIds.push(created.id);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: "user-only@example.com",
      name: "Normal User",
      role: "user",
    }));

    const result = await deleteExperienceAction({
      experienceId: created.id,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `exp-action-${suffix}@example.com`,
      name: "Exp Action Curator",
      role: "curator",
    }));
  });
});
