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
  createTagAction,
  deleteTagAction,
  updateTagAction,
} from "../src/lib/admin/tag-actions";
import {
  parseSearchQuery,
  parseTagNotice,
} from "../src/lib/admin/tag-helpers";
import { listAdminTags } from "../src/lib/admin/tags";
import { listAdminExperiences } from "../src/lib/admin/experiences";
import { parseTagFilter } from "../src/lib/admin/experience-helpers";
import { validateTagNameInput } from "../src/lib/tags/validation";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

describe("tag admin helpers and validation", () => {
  it("parses search and notices", () => {
    assert.equal(parseSearchQuery("  sunsets  "), "sunsets");
    assert.equal(parseTagNotice("created"), "created");
    assert.equal(parseTagNotice("deleted"), "deleted");
    assert.equal(parseTagNotice("nope"), null);
    assert.equal(parseTagFilter("abc"), "abc");
    assert.equal(parseTagFilter("all"), undefined);
  });

  it("requires a trimmed tag name", () => {
    const empty = validateTagNameInput({ name: "   " });
    assert.equal(empty.ok, false);
    if (!empty.ok) {
      assert.ok(empty.details?.name);
    }

    const valid = validateTagNameInput({ name: "  Sunset  " });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.data.name, "Sunset");
    }
  });
});

describe("tag admin list and experience usage", () => {
  const suffix = Date.now().toString(36);
  const placeIds: string[] = [];
  const experienceIds: string[] = [];
  const tagIds: string[] = [];

  let tagAId = "";
  let tagBId = "";
  let experienceAId = "";

  before(async () => {
    const [seededPlace] = await db
      .insert(place)
      .values({
        name: `Tag Admin Place ${suffix}`,
        slug: `tag-admin-place-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeIds.push(seededPlace.id);

    const tags = await db
      .insert(tag)
      .values([
        { name: `Sunsets ${suffix}` },
        { name: `Quiet Trails ${suffix}` },
      ])
      .returning();
    tagAId = tags[0]!.id;
    tagBId = tags[1]!.id;
    tagIds.push(tagAId, tagBId);

    const [createdExperience] = await db
      .insert(experience)
      .values({
        placeId: seededPlace.id,
        title: `Tagged Experience ${suffix}`,
        description: "Has a sunset tag",
        goodToKnow: null,
      })
      .returning();
    experienceAId = createdExperience.id;
    experienceIds.push(experienceAId);

    await db.insert(experienceTag).values({
      experienceId: experienceAId,
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

  it("lists tags with experience usage counts", async () => {
    const items = await listAdminTags({});
    const matchA = items.find((item) => item.id === tagAId);
    const matchB = items.find((item) => item.id === tagBId);

    assert.ok(matchA);
    assert.equal(matchA.name, `Sunsets ${suffix}`);
    assert.equal(matchA.experienceCount, 1);

    assert.ok(matchB);
    assert.equal(matchB.experienceCount, 0);
  });

  it("filters tags by name search", async () => {
    const byName = await listAdminTags({ query: `Quiet Trails ${suffix}` });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]?.id, tagBId);
  });

  it("filters experiences by tagId", async () => {
    const byTag = await listAdminExperiences({ tagId: tagAId });
    assert.ok(byTag.some((item) => item.id === experienceAId));

    const unused = await listAdminExperiences({ tagId: tagBId });
    assert.equal(
      unused.some((item) => item.id === experienceAId),
      false,
    );
  });
});

describe("tag moderation actions", () => {
  const suffix = `${Date.now().toString(36)}-act`;
  const placeIds: string[] = [];
  const userIds: string[] = [];
  const experienceIds: string[] = [];
  const tagIds: string[] = [];

  let userId = "";
  let placeId = "";

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Tag Action Curator",
        email: `tag-action-${suffix}@example.com`,
        role: "curator",
      })
      .returning();
    userId = seededUser.id;
    userIds.push(userId);

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: `Tag Action Place ${suffix}`,
        slug: `tag-action-place-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeId = seededPlace.id;
    placeIds.push(placeId);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `tag-action-${suffix}@example.com`,
      name: "Tag Action Curator",
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
    const result = await createTagAction({ name: `Nope ${suffix}` });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unauthorized");
    }
    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `tag-action-${suffix}@example.com`,
      name: "Tag Action Curator",
      role: "curator",
    }));
  });

  it("returns validation errors for empty names", async () => {
    const result = await createTagAction({ name: "   " });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_input");
      assert.ok(result.fieldErrors?.name);
    }
  });

  it("creates, renames, handles duplicates, and deletes", async () => {
    const createName = `Created Tag ${suffix}`;

    try {
      await createTagAction({ name: `  ${createName}  ` });
      assert.fail("expected redirect after create");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [created] = await db
      .select()
      .from(tag)
      .where(eq(tag.name, createName))
      .limit(1);
    assert.ok(created);
    tagIds.push(created.id);

    const otherName = `Other Tag ${suffix}`;
    const [other] = await db
      .insert(tag)
      .values({ name: otherName })
      .returning();
    tagIds.push(other.id);

    const duplicateCreate = await createTagAction({ name: otherName });
    assert.equal(duplicateCreate.ok, false);
    if (!duplicateCreate.ok) {
      assert.equal(duplicateCreate.code, "conflict");
      assert.ok(duplicateCreate.fieldErrors?.name);
    }

    const renamed = `Renamed Tag ${suffix}`;
    try {
      await updateTagAction({
        tagId: created.id,
        name: `  ${renamed}  `,
      });
      assert.fail("expected redirect after rename");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [afterRename] = await db
      .select()
      .from(tag)
      .where(eq(tag.id, created.id))
      .limit(1);
    assert.equal(afterRename?.name, renamed);

    const duplicateRename = await updateTagAction({
      tagId: created.id,
      name: otherName,
    });
    assert.equal(duplicateRename.ok, false);
    if (!duplicateRename.ok) {
      assert.equal(duplicateRename.code, "conflict");
      assert.ok(duplicateRename.fieldErrors?.name);
    }

    try {
      await deleteTagAction({ tagId: created.id });
      assert.fail("expected redirect after delete");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [deleted] = await db
      .select()
      .from(tag)
      .where(eq(tag.id, created.id))
      .limit(1);
    assert.equal(deleted, undefined);
    tagIds.splice(tagIds.indexOf(created.id), 1);
  });

  it("deletes a tag and cascades experience relationships without deleting experiences", async () => {
    const [createdTag] = await db
      .insert(tag)
      .values({ name: `Cascade Tag ${suffix}` })
      .returning();
    tagIds.push(createdTag.id);

    const [createdExperience] = await db
      .insert(experience)
      .values({
        placeId,
        title: `Cascade Experience ${suffix}`,
        description: "Keeps living",
        goodToKnow: null,
      })
      .returning();
    experienceIds.push(createdExperience.id);

    await db.insert(experienceTag).values({
      experienceId: createdExperience.id,
      tagId: createdTag.id,
    });

    try {
      await deleteTagAction({ tagId: createdTag.id });
      assert.fail("expected redirect after delete");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [tagGone] = await db
      .select()
      .from(tag)
      .where(eq(tag.id, createdTag.id))
      .limit(1);
    assert.equal(tagGone, undefined);
    tagIds.splice(tagIds.indexOf(createdTag.id), 1);

    const joinRows = await db
      .select()
      .from(experienceTag)
      .where(eq(experienceTag.experienceId, createdExperience.id));
    assert.equal(joinRows.length, 0);

    const [experienceStillThere] = await db
      .select()
      .from(experience)
      .where(eq(experience.id, createdExperience.id))
      .limit(1);
    assert.ok(experienceStillThere);
  });

  it("forbids normal users from deleting tags", async () => {
    const [created] = await db
      .insert(tag)
      .values({ name: `Forbidden Tag ${suffix}` })
      .returning();
    tagIds.push(created.id);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: "user-only@example.com",
      name: "Normal User",
      role: "user",
    }));

    const result = await deleteTagAction({ tagId: created.id });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `tag-action-${suffix}@example.com`,
      name: "Tag Action Curator",
      role: "curator",
    }));
  });
});
