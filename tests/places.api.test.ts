import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { DELETE, GET, PATCH } from "../src/app/api/places/[slug]/route";
import { GET as listPlaces, POST as createPlace } from "../src/app/api/places/route";
import { db } from "../src/db";
import { experience, place } from "../src/db/schema";

const suffix = Date.now().toString(36);
const primarySlug = `test-place-api-${suffix}`;
const secondarySlug = `test-place-api-alt-${suffix}`;
const updatedSlug = `test-place-api-updated-${suffix}`;

const createdSlugs = new Set<string>([primarySlug, secondarySlug, updatedSlug]);

async function cleanup() {
  for (const slug of createdSlugs) {
    const rows = await db
      .select({ id: place.id })
      .from(place)
      .where(eq(place.slug, slug))
      .limit(1);

    const placeId = rows[0]?.id;
    if (!placeId) {
      continue;
    }

    await db.delete(experience).where(eq(experience.placeId, placeId));
    await db.delete(place).where(eq(place.id, placeId));
  }
}

async function readJson(response: Response) {
  return response.json();
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe("Place API", () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  it("creates a valid Place", async () => {
    const response = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Place",
          slug: primarySlug,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        }),
      }),
    );

    assert.equal(response.status, 201);
    const body = await readJson(response);
    assert.equal(body.place.slug, primarySlug);
    assert.equal(body.place.name, "Test Place");
    assert.ok(body.place.id);
  });

  it("rejects missing required fields", async () => {
    const response = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Incomplete" }),
      }),
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("rejects invalid coordinates", async () => {
    const response = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bad Coords",
          slug: `test-place-api-bad-coords-${suffix}`,
          city: "Asheville",
          state: "NC",
          latitude: 100,
          longitude: 0,
        }),
      }),
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("rejects duplicate slug", async () => {
    const response = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate",
          slug: primarySlug,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        }),
      }),
    );

    assert.equal(response.status, 409);
    const body = await readJson(response);
    assert.equal(body.error.code, "conflict");
  });

  it("retrieves Places", async () => {
    const response = await listPlaces();
    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.places));
    assert.ok(
      body.places.some((item: { slug: string }) => item.slug === primarySlug),
    );
  });

  it("retrieves a Place by slug", async () => {
    const response = await GET(
      createRequest(`http://localhost/api/places/${primarySlug}`),
      { params: Promise.resolve({ slug: primarySlug }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.place.slug, primarySlug);
  });

  it("handles a non-existent Place", async () => {
    const missingSlug = `test-place-api-missing-${suffix}`;
    const response = await GET(
      createRequest(`http://localhost/api/places/${missingSlug}`),
      { params: Promise.resolve({ slug: missingSlug }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
  });

  it("updates a Place", async () => {
    const response = await PATCH(
      createRequest(`http://localhost/api/places/${primarySlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Test Place",
          slug: updatedSlug,
        }),
      }),
      { params: Promise.resolve({ slug: primarySlug }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.place.name, "Updated Test Place");
    assert.equal(body.place.slug, updatedSlug);
  });

  it("prevents invalid updates", async () => {
    const response = await PATCH(
      createRequest(`http://localhost/api/places/${updatedSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: 999,
        }),
      }),
      { params: Promise.resolve({ slug: updatedSlug }) },
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("deletes a Place", async () => {
    const createResponse = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Disposable Place",
          slug: secondarySlug,
          city: "Durham",
          state: "NC",
          latitude: 35.994,
          longitude: -78.8986,
        }),
      }),
    );
    assert.equal(createResponse.status, 201);

    const response = await DELETE(
      createRequest(`http://localhost/api/places/${secondarySlug}`),
      { params: Promise.resolve({ slug: secondarySlug }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.deleted, true);

    const missing = await GET(
      createRequest(`http://localhost/api/places/${secondarySlug}`),
      { params: Promise.resolve({ slug: secondarySlug }) },
    );
    assert.equal(missing.status, 404);
  });

  it("respects foreign-key restrictions when deletion is not allowed", async () => {
    const blockedSlug = `test-place-api-blocked-${suffix}`;
    createdSlugs.add(blockedSlug);

    const createResponse = await createPlace(
      createRequest("http://localhost/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Blocked Place",
          slug: blockedSlug,
          city: "Raleigh",
          state: "NC",
          latitude: 35.7796,
          longitude: -78.6382,
        }),
      }),
    );
    assert.equal(createResponse.status, 201);
    const created = await readJson(createResponse);

    await db.insert(experience).values({
      placeId: created.place.id,
      title: "Temporary experience for FK test",
    });

    const response = await DELETE(
      createRequest(`http://localhost/api/places/${blockedSlug}`),
      { params: Promise.resolve({ slug: blockedSlug }) },
    );

    assert.equal(response.status, 409);
    const body = await readJson(response);
    assert.equal(body.error.code, "conflict");
  });
});
