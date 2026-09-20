import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { experience, place, user } from "../src/db/schema";
import {
  resetAuthenticatedUserResolver,
  setAuthenticatedUserResolver,
} from "../src/lib/auth/authenticated-user";
import {
  createPlaceAction,
  deletePlaceAction,
  updatePlaceAction,
} from "../src/lib/admin/place-actions";
import {
  formatCoordinates,
  parseCityFilter,
  parsePlaceNotice,
  parseSearchQuery,
} from "../src/lib/admin/place-helpers";
import { getPlaceEditorData, listAdminPlaces } from "../src/lib/admin/places";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

describe("place admin helpers", () => {
  it("parses search, city filter, and notices", () => {
    assert.equal(parseSearchQuery("  ridge  "), "ridge");
    assert.equal(parseCityFilter("  Asheville "), "Asheville");
    assert.equal(parsePlaceNotice("created"), "created");
    assert.equal(parsePlaceNotice("deleted"), "deleted");
    assert.equal(parsePlaceNotice("nope"), null);
  });

  it("formats coordinates for list display", () => {
    assert.equal(formatCoordinates(35.5951, -82.5515), "35.5951, -82.5515");
  });
});

describe("place admin list and detail loaders", () => {
  const suffix = Date.now().toString(36);
  const placeIds: string[] = [];
  const experienceIds: string[] = [];

  let placeAId = "";
  let placeASlug = "";
  let placeBId = "";

  before(async () => {
    const places = await db
      .insert(place)
      .values([
        {
          name: `Blue Ridge Overlook ${suffix}`,
          slug: `blue-ridge-overlook-${suffix}`,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        },
        {
          name: `City Market ${suffix}`,
          slug: `city-market-${suffix}`,
          city: "Durham",
          state: "NC",
          latitude: 35.994,
          longitude: -78.8986,
        },
      ])
      .returning();

    placeAId = places[0]!.id;
    placeASlug = places[0]!.slug;
    placeBId = places[1]!.id;
    placeIds.push(placeAId, placeBId);

    const [createdExperience] = await db
      .insert(experience)
      .values({
        placeId: placeAId,
        title: `Place Admin Exp ${suffix}`,
        description: "Linked to place A",
        goodToKnow: null,
      })
      .returning();
    experienceIds.push(createdExperience.id);
  });

  after(async () => {
    for (const id of experienceIds) {
      await db.delete(experience).where(eq(experience.id, id));
    }
    for (const id of placeIds) {
      await db.delete(place).where(eq(place.id, id));
    }
  });

  it("lists places with experience counts", async () => {
    const items = await listAdminPlaces({});
    const matchA = items.find((item) => item.id === placeAId);
    const matchB = items.find((item) => item.id === placeBId);

    assert.ok(matchA);
    assert.equal(matchA.name, `Blue Ridge Overlook ${suffix}`);
    assert.equal(matchA.city, "Asheville");
    assert.equal(matchA.state, "NC");
    assert.equal(matchA.slug, placeASlug);
    assert.equal(matchA.experienceCount, 1);

    assert.ok(matchB);
    assert.equal(matchB.experienceCount, 0);
  });

  it("filters by name search and city", async () => {
    const byName = await listAdminPlaces({
      query: `Blue Ridge Overlook ${suffix}`,
    });
    assert.equal(byName.length, 1);
    assert.equal(byName[0]?.id, placeAId);

    const byCity = await listAdminPlaces({ city: "Durham" });
    assert.ok(byCity.some((item) => item.id === placeBId));
    assert.equal(
      byCity.some((item) => item.id === placeAId),
      false,
    );
  });

  it("loads place detail with experience count", async () => {
    const data = await getPlaceEditorData(placeASlug);
    assert.ok(data);
    assert.equal(data.place.id, placeAId);
    assert.equal(data.experienceCount, 1);

    const missing = await getPlaceEditorData(`missing-${suffix}`);
    assert.equal(missing, null);
  });
});

describe("place moderation actions", () => {
  const suffix = `${Date.now().toString(36)}-act`;
  const placeIds: string[] = [];
  const userIds: string[] = [];
  const experienceIds: string[] = [];

  let userId = "";

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Place Action Curator",
        email: `place-action-${suffix}@example.com`,
        role: "curator",
      })
      .returning();
    userId = seededUser.id;
    userIds.push(userId);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `place-action-${suffix}@example.com`,
      name: "Place Action Curator",
      role: "curator",
    }));
  });

  after(async () => {
    resetAuthenticatedUserResolver();
    for (const id of experienceIds) {
      await db.delete(experience).where(eq(experience.id, id));
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
    const result = await createPlaceAction({
      name: "Nope",
      slug: `nope-${suffix}`,
      city: "Asheville",
      state: "NC",
      latitude: "35.5",
      longitude: "-82.5",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unauthorized");
    }
    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `place-action-${suffix}@example.com`,
      name: "Place Action Curator",
      role: "curator",
    }));
  });

  it("returns validation errors for invalid slug and coordinates", async () => {
    const badSlug = await createPlaceAction({
      name: "Bad Slug Place",
      slug: "Bad Slug!",
      city: "Asheville",
      state: "NC",
      latitude: "35.5",
      longitude: "-82.5",
    });
    assert.equal(badSlug.ok, false);
    if (!badSlug.ok) {
      assert.equal(badSlug.code, "invalid_input");
      assert.ok(badSlug.fieldErrors?.slug);
    }

    const badLat = await createPlaceAction({
      name: "Bad Lat Place",
      slug: `bad-lat-${suffix}`,
      city: "Asheville",
      state: "NC",
      latitude: "120",
      longitude: "-82.5",
    });
    assert.equal(badLat.ok, false);
    if (!badLat.ok) {
      assert.equal(badLat.code, "invalid_input");
      assert.ok(badLat.fieldErrors?.latitude);
    }

    const badLng = await createPlaceAction({
      name: "Bad Lng Place",
      slug: `bad-lng-${suffix}`,
      city: "Asheville",
      state: "NC",
      latitude: "35.5",
      longitude: "-200",
    });
    assert.equal(badLng.ok, false);
    if (!badLng.ok) {
      assert.equal(badLng.code, "invalid_input");
      assert.ok(badLng.fieldErrors?.longitude);
    }
  });

  it("creates, updates, handles duplicate slug, and deletes", async () => {
    const createSlug = `created-place-${suffix}`;

    try {
      await createPlaceAction({
        name: `Created Place ${suffix}`,
        slug: createSlug,
        city: "Asheville",
        state: "NC",
        latitude: "35.5951",
        longitude: "-82.5515",
      });
      assert.fail("expected redirect after create");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [created] = await db
      .select()
      .from(place)
      .where(eq(place.slug, createSlug))
      .limit(1);
    assert.ok(created);
    placeIds.push(created.id);

    const updateResult = await updatePlaceAction({
      currentSlug: createSlug,
      name: `Updated Place ${suffix}`,
      slug: createSlug,
      city: "Durham",
      state: "NC",
      latitude: "35.994",
      longitude: "-78.8986",
    });
    assert.equal(updateResult.ok, true);

    const [updated] = await db
      .select()
      .from(place)
      .where(eq(place.id, created.id))
      .limit(1);
    assert.equal(updated?.name, `Updated Place ${suffix}`);
    assert.equal(updated?.city, "Durham");

    const otherSlug = `other-place-${suffix}`;
    const [other] = await db
      .insert(place)
      .values({
        name: `Other Place ${suffix}`,
        slug: otherSlug,
        city: "Raleigh",
        state: "NC",
        latitude: 35.7796,
        longitude: -78.6382,
      })
      .returning();
    placeIds.push(other.id);

    const duplicate = await updatePlaceAction({
      currentSlug: createSlug,
      name: `Updated Place ${suffix}`,
      slug: otherSlug,
      city: "Durham",
      state: "NC",
      latitude: "35.994",
      longitude: "-78.8986",
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.code, "conflict");
      assert.ok(duplicate.fieldErrors?.slug);
    }

    const createDuplicate = await createPlaceAction({
      name: "Duplicate Create",
      slug: otherSlug,
      city: "Cary",
      state: "NC",
      latitude: "35.7",
      longitude: "-78.7",
    });
    assert.equal(createDuplicate.ok, false);
    if (!createDuplicate.ok) {
      assert.equal(createDuplicate.code, "conflict");
      assert.ok(createDuplicate.fieldErrors?.slug);
    }

    try {
      await deletePlaceAction({ slug: createSlug });
      assert.fail("expected redirect after delete");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [deleted] = await db
      .select()
      .from(place)
      .where(eq(place.id, created.id))
      .limit(1);
    assert.equal(deleted, undefined);
    placeIds.splice(placeIds.indexOf(created.id), 1);
  });

  it("explains foreign-key deletion failures without raw database errors", async () => {
    const blockedSlug = `blocked-place-${suffix}`;
    const [blocked] = await db
      .insert(place)
      .values({
        name: `Blocked Place ${suffix}`,
        slug: blockedSlug,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeIds.push(blocked.id);

    const [linkedExperience] = await db
      .insert(experience)
      .values({
        placeId: blocked.id,
        title: `Blocking Experience ${suffix}`,
        description: "Keeps the place",
        goodToKnow: null,
      })
      .returning();
    experienceIds.push(linkedExperience.id);

    const result = await deletePlaceAction({ slug: blockedSlug });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "conflict");
      assert.match(result.message, /experiences or submissions/i);
      assert.equal(result.message.includes("23503"), false);
      assert.equal(result.message.includes("foreign key"), false);
    }

    const [stillThere] = await db
      .select()
      .from(place)
      .where(eq(place.id, blocked.id))
      .limit(1);
    assert.ok(stillThere);
  });

  it("forbids normal users from deleting places", async () => {
    const forbiddenSlug = `forbidden-place-${suffix}`;
    const [created] = await db
      .insert(place)
      .values({
        name: `Forbidden Place ${suffix}`,
        slug: forbiddenSlug,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeIds.push(created.id);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: "user-only@example.com",
      name: "Normal User",
      role: "user",
    }));

    const result = await deletePlaceAction({ slug: forbiddenSlug });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `place-action-${suffix}@example.com`,
      name: "Place Action Curator",
      role: "curator",
    }));
  });

  it("redirects when a place slug is changed on update", async () => {
    const oldSlug = `rename-old-${suffix}`;
    const newSlug = `rename-new-${suffix}`;
    const [created] = await db
      .insert(place)
      .values({
        name: `Rename Place ${suffix}`,
        slug: oldSlug,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeIds.push(created.id);

    try {
      await updatePlaceAction({
        currentSlug: oldSlug,
        name: `Rename Place ${suffix}`,
        slug: newSlug,
        city: "Asheville",
        state: "NC",
        latitude: "35.5951",
        longitude: "-82.5515",
      });
      assert.fail("expected redirect after slug change");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [renamed] = await db
      .select()
      .from(place)
      .where(eq(place.id, created.id))
      .limit(1);
    assert.equal(renamed?.slug, newSlug);
  });
});
