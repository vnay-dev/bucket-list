import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import {
  DELETE,
  GET,
  PATCH,
} from "../src/app/api/experiences/[id]/route";
import {
  DELETE as removeTag,
} from "../src/app/api/experiences/[id]/tags/[tagId]/route";
import {
  GET as listTags,
  POST as assignTags,
} from "../src/app/api/experiences/[id]/tags/route";
import {
  GET as listExperiences,
  POST as createExperience,
} from "../src/app/api/experiences/route";
import { db } from "../src/db";
import {
  experience,
  experienceTag,
  place,
  tag,
} from "../src/db/schema";

const suffix = Date.now().toString(36);
const placeSlugA = `test-exp-place-a-${suffix}`;
const placeSlugB = `test-exp-place-b-${suffix}`;
const tagNameA = `test-exp-tag-a-${suffix}`;
const tagNameB = `test-exp-tag-b-${suffix}`;
const tagNameC = `test-exp-tag-c-${suffix}`;

const createdPlaceIds = new Set<string>();
const createdExperienceIds = new Set<string>();
const createdTagIds = new Set<string>();

let placeAId = "";
let placeBId = "";
let tagAId = "";
let tagBId = "";
let tagCId = "";
let experienceId = "";
let filteredExperienceId = "";

async function cleanup() {
  if (createdExperienceIds.size > 0) {
    const ids = [...createdExperienceIds];
    await db
      .delete(experienceTag)
      .where(inArray(experienceTag.experienceId, ids));
    await db.delete(experience).where(inArray(experience.id, ids));
  }

  if (createdTagIds.size > 0) {
    await db.delete(tag).where(inArray(tag.id, [...createdTagIds]));
  }

  if (createdPlaceIds.size > 0) {
    await db.delete(place).where(inArray(place.id, [...createdPlaceIds]));
  }
}

async function readJson(response: Response) {
  return response.json();
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("Experience API", () => {
  before(async () => {
    await cleanup();

    const places = await db
      .insert(place)
      .values([
        {
          name: "Experience Test Place A",
          slug: placeSlugA,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        },
        {
          name: "Experience Test Place B",
          slug: placeSlugB,
          city: "Durham",
          state: "NC",
          latitude: 35.994,
          longitude: -78.8986,
        },
      ])
      .returning();

    placeAId = places[0]!.id;
    placeBId = places[1]!.id;
    createdPlaceIds.add(placeAId);
    createdPlaceIds.add(placeBId);

    const tags = await db
      .insert(tag)
      .values([
        { name: tagNameA },
        { name: tagNameB },
        { name: tagNameC },
      ])
      .returning();

    tagAId = tags[0]!.id;
    tagBId = tags[1]!.id;
    tagCId = tags[2]!.id;
    createdTagIds.add(tagAId);
    createdTagIds.add(tagBId);
    createdTagIds.add(tagCId);
  });

  after(async () => {
    await cleanup();
  });

  it("creates a valid Experience", async () => {
    const response = await createExperience(
      createRequest("http://localhost/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeAId,
          title: "Sunset Overlook",
          description: "Watch the sun set over the ridge",
          goodToKnow: "Arrive 30 minutes early",
        }),
      }),
    );

    assert.equal(response.status, 201);
    const body = await readJson(response);
    assert.equal(body.experience.title, "Sunset Overlook");
    assert.equal(body.experience.placeId, placeAId);
    assert.equal(body.experience.description, "Watch the sun set over the ridge");
    assert.equal(body.experience.goodToKnow, "Arrive 30 minutes early");
    assert.deepEqual(body.experience.tags, []);
    assert.ok(body.experience.id);
    experienceId = body.experience.id;
    createdExperienceIds.add(experienceId);
  });

  it("rejects missing required fields", async () => {
    const response = await createExperience(
      createRequest("http://localhost/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Missing title and place" }),
      }),
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("rejects invalid Place", async () => {
    const response = await createExperience(
      createRequest("http://localhost/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          title: "Missing Place Experience",
        }),
      }),
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
    assert.equal(body.error.message, "Place not found");
  });

  it("lists Experiences", async () => {
    const response = await listExperiences(
      createRequest("http://localhost/api/experiences"),
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.experiences));
    assert.ok(
      body.experiences.some(
        (item: { id: string }) => item.id === experienceId,
      ),
    );
  });

  it("filters Experiences by Place", async () => {
    const createResponse = await createExperience(
      createRequest("http://localhost/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeBId,
          title: "River Walk",
        }),
      }),
    );
    assert.equal(createResponse.status, 201);
    const created = await readJson(createResponse);
    filteredExperienceId = created.experience.id;
    createdExperienceIds.add(filteredExperienceId);

    const response = await listExperiences(
      createRequest(
        `http://localhost/api/experiences?placeId=${placeBId}`,
      ),
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.experiences));
    assert.ok(
      body.experiences.every(
        (item: { placeId: string }) => item.placeId === placeBId,
      ),
    );
    assert.ok(
      body.experiences.some(
        (item: { id: string }) => item.id === filteredExperienceId,
      ),
    );
    assert.ok(
      !body.experiences.some(
        (item: { id: string }) => item.id === experienceId,
      ),
    );
  });

  it("retrieves an Experience", async () => {
    const response = await GET(
      createRequest(`http://localhost/api/experiences/${experienceId}`),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.experience.id, experienceId);
    assert.equal(body.experience.title, "Sunset Overlook");
    assert.ok(Array.isArray(body.experience.tags));
  });

  it("handles a non-existent Experience", async () => {
    const missingId = "99999999-9999-4999-8999-999999999999";
    const response = await GET(
      createRequest(`http://localhost/api/experiences/${missingId}`),
      { params: Promise.resolve({ id: missingId }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
  });

  it("updates an Experience", async () => {
    const response = await PATCH(
      createRequest(`http://localhost/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Sunset Overlook",
          placeId: placeBId,
          goodToKnow: "Bring a jacket",
        }),
      }),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.experience.title, "Updated Sunset Overlook");
    assert.equal(body.experience.placeId, placeBId);
    assert.equal(body.experience.goodToKnow, "Bring a jacket");
  });

  it("rejects an invalid update", async () => {
    const response = await PATCH(
      createRequest(`http://localhost/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
        }),
      }),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("assigns a Tag to an Experience", async () => {
    const response = await assignTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: [tagAId] }),
        },
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 201);
    const body = await readJson(response);
    assert.ok(
      body.tags.some((item: { id: string }) => item.id === tagAId),
    );
  });

  it("assigns multiple Tags to an Experience", async () => {
    const response = await assignTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: [tagBId, tagCId] }),
        },
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 201);
    const body = await readJson(response);
    assert.ok(body.tags.some((item: { id: string }) => item.id === tagAId));
    assert.ok(body.tags.some((item: { id: string }) => item.id === tagBId));
    assert.ok(body.tags.some((item: { id: string }) => item.id === tagCId));
  });

  it("retrieves an Experience with Tags", async () => {
    const response = await GET(
      createRequest(`http://localhost/api/experiences/${experienceId}`),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.experience.tags));
    assert.equal(body.experience.tags.length, 3);
    assert.ok(
      body.experience.tags.every(
        (item: { id: string; name: string }) => item.id && item.name,
      ),
    );
  });

  it("retrieves Tags for an Experience", async () => {
    const response = await listTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.tags));
    assert.equal(body.tags.length, 3);
  });

  it("prevents duplicate Experience/Tag assignment", async () => {
    const response = await assignTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: [tagAId] }),
        },
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 409);
    const body = await readJson(response);
    assert.equal(body.error.code, "conflict");
  });

  it("rejects a non-existent Tag", async () => {
    const missingTagId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const response = await assignTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagIds: [missingTagId] }),
        },
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
  });

  it("removes a Tag from an Experience", async () => {
    const response = await removeTag(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags/${tagAId}`,
      ),
      {
        params: Promise.resolve({ id: experienceId, tagId: tagAId }),
      },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.deleted, true);

    const tagsResponse = await listTags(
      createRequest(
        `http://localhost/api/experiences/${experienceId}/tags`,
      ),
      { params: Promise.resolve({ id: experienceId }) },
    );
    const tagsBody = await readJson(tagsResponse);
    assert.ok(
      !tagsBody.tags.some((item: { id: string }) => item.id === tagAId),
    );
  });

  it("deletes an Experience", async () => {
    const createResponse = await createExperience(
      createRequest("http://localhost/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeAId,
          title: "Disposable Experience",
        }),
      }),
    );
    assert.equal(createResponse.status, 201);
    const created = await readJson(createResponse);
    const disposableId = created.experience.id as string;
    createdExperienceIds.add(disposableId);

    await db.insert(experienceTag).values({
      experienceId: disposableId,
      tagId: tagAId,
    });

    const response = await DELETE(
      createRequest(`http://localhost/api/experiences/${disposableId}`),
      { params: Promise.resolve({ id: disposableId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.deleted, true);

    const missing = await GET(
      createRequest(`http://localhost/api/experiences/${disposableId}`),
      { params: Promise.resolve({ id: disposableId }) },
    );
    assert.equal(missing.status, 404);

    const remainingLinks = await db
      .select()
      .from(experienceTag)
      .where(eq(experienceTag.experienceId, disposableId));
    assert.equal(remainingLinks.length, 0);

    createdExperienceIds.delete(disposableId);
  });

  it("respects database constraints for invalid place references on update", async () => {
    const response = await PATCH(
      createRequest(`http://localhost/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        }),
      }),
      { params: Promise.resolve({ id: experienceId }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
    assert.equal(body.error.message, "Place not found");
  });
});
