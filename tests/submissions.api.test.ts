import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { POST as approveSubmissionRoute } from "../src/app/api/submissions/[id]/approve/route";
import { POST as mergeSubmissionRoute } from "../src/app/api/submissions/[id]/merge/route";
import { POST as rejectSubmissionRoute } from "../src/app/api/submissions/[id]/reject/route";
import {
  GET as getSubmission,
  PATCH as patchSubmission,
} from "../src/app/api/submissions/[id]/route";
import {
  GET as listSubmissionsRoute,
  POST as createSubmissionRoute,
} from "../src/app/api/submissions/route";
import { db } from "../src/db";
import { experience, place, submission, user } from "../src/db/schema";
import { createSubmission } from "../src/lib/submissions/repository";

const suffix = Date.now().toString(36);
const placeSlugA = `test-sub-place-a-${suffix}`;
const placeSlugB = `test-sub-place-b-${suffix}`;
const userEmail = `test-sub-user-${suffix}@example.com`;

const createdPlaceIds = new Set<string>();
const createdUserIds = new Set<string>();
const createdSubmissionIds = new Set<string>();
const createdExperienceIds = new Set<string>();

let placeAId = "";
let placeBId = "";
let userId = "";
let pendingSubmissionId = "";
let existingExperienceId = "";

async function cleanup() {
  if (createdSubmissionIds.size > 0) {
    await db
      .delete(submission)
      .where(inArray(submission.id, [...createdSubmissionIds]));
  }

  if (createdExperienceIds.size > 0) {
    await db
      .delete(experience)
      .where(inArray(experience.id, [...createdExperienceIds]));
  }

  if (createdPlaceIds.size > 0) {
    await db.delete(place).where(inArray(place.id, [...createdPlaceIds]));
  }

  if (createdUserIds.size > 0) {
    await db.delete(user).where(inArray(user.id, [...createdUserIds]));
  }
}

async function readJson(response: Response) {
  return response.json();
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

async function seedPendingSubmission(content: string, placeId = placeAId) {
  const created = await createSubmission(userId, {
    placeId,
    content,
    goodToKnow: "Pack water",
  });
  createdSubmissionIds.add(created.id);
  return created;
}

function trackExperienceFromSubmission(experienceId: string | null) {
  if (experienceId) {
    createdExperienceIds.add(experienceId);
  }
}

describe("Submission API", () => {
  before(async () => {
    await cleanup();

    const places = await db
      .insert(place)
      .values([
        {
          name: "Submission Test Place A",
          slug: placeSlugA,
          city: "Asheville",
          state: "NC",
          latitude: 35.5951,
          longitude: -82.5515,
        },
        {
          name: "Submission Test Place B",
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

    const users = await db
      .insert(user)
      .values({
        name: "Submission Tester",
        email: userEmail,
        role: "user",
      })
      .returning();

    userId = users[0]!.id;
    createdUserIds.add(userId);

    const experiences = await db
      .insert(experience)
      .values({
        placeId: placeAId,
        title: "Existing Curated Experience",
        description: "Already curated",
        goodToKnow: null,
      })
      .returning();

    existingExperienceId = experiences[0]!.id;
    createdExperienceIds.add(existingExperienceId);
  });

  after(async () => {
    await cleanup();
  });

  it("creates a pending submission for an authenticated user identity", async () => {
    const created = await createSubmission(userId, {
      placeId: placeAId,
      content: "Hike the ridge trail at sunrise",
      goodToKnow: "Arrive early for parking",
    });

    createdSubmissionIds.add(created.id);
    pendingSubmissionId = created.id;

    assert.equal(created.userId, userId);
    assert.equal(created.placeId, placeAId);
    assert.equal(created.content, "Hike the ridge trail at sunrise");
    assert.equal(created.goodToKnow, "Arrive early for parking");
    assert.equal(created.status, "pending");
    assert.equal(created.experienceId, null);
  });

  it("rejects create via HTTP without authentication", async () => {
    const response = await createSubmissionRoute(
      createRequest("http://localhost/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: placeAId,
          content: "Should not be created without auth",
        }),
      }),
    );

    assert.equal(response.status, 401);
    const body = await readJson(response);
    assert.equal(body.error.code, "unauthorized");
  });

  it("rejects validation failures on create", async () => {
    const response = await createSubmissionRoute(
      createRequest("http://localhost/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   " }),
      }),
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("rejects create when Place is missing", async () => {
    await assert.rejects(
      () =>
        createSubmission(userId, {
          placeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          content: "Missing place submission",
          goodToKnow: null,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          (error as { code?: string }).code,
          "place_not_found",
        );
        return true;
      },
    );
  });

  it("lists submissions", async () => {
    const response = await listSubmissionsRoute(
      createRequest("http://localhost/api/submissions"),
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.ok(Array.isArray(body.submissions));
    assert.ok(
      body.submissions.some(
        (item: { id: string }) => item.id === pendingSubmissionId,
      ),
    );
  });

  it("filters submissions by status and placeId", async () => {
    const other = await seedPendingSubmission("Filter target submission", placeBId);

    const byPlace = await listSubmissionsRoute(
      createRequest(
        `http://localhost/api/submissions?placeId=${placeBId}&status=pending`,
      ),
    );
    assert.equal(byPlace.status, 200);
    const placeBody = await readJson(byPlace);
    assert.ok(
      placeBody.submissions.every(
        (item: { placeId: string; status: string }) =>
          item.placeId === placeBId && item.status === "pending",
      ),
    );
    assert.ok(
      placeBody.submissions.some(
        (item: { id: string }) => item.id === other.id,
      ),
    );

    const byStatus = await listSubmissionsRoute(
      createRequest("http://localhost/api/submissions?status=approved"),
    );
    assert.equal(byStatus.status, 200);
    const statusBody = await readJson(byStatus);
    assert.ok(
      !statusBody.submissions.some(
        (item: { id: string }) => item.id === pendingSubmissionId,
      ),
    );
  });

  it("gets a submission by id", async () => {
    const response = await getSubmission(
      createRequest(`http://localhost/api/submissions/${pendingSubmissionId}`),
      { params: Promise.resolve({ id: pendingSubmissionId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.id, pendingSubmissionId);
    assert.equal(body.submission.status, "pending");
  });

  it("returns not found for a missing submission", async () => {
    const missingId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const response = await getSubmission(
      createRequest(`http://localhost/api/submissions/${missingId}`),
      { params: Promise.resolve({ id: missingId }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
  });

  it("updates a submission", async () => {
    const response = await patchSubmission(
      createRequest(`http://localhost/api/submissions/${pendingSubmissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "Updated ridge trail tip",
          goodToKnow: null,
          placeId: placeBId,
        }),
      }),
      { params: Promise.resolve({ id: pendingSubmissionId }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.content, "Updated ridge trail tip");
    assert.equal(body.submission.goodToKnow, null);
    assert.equal(body.submission.placeId, placeBId);
    assert.equal(body.submission.status, "pending");
  });

  it("rejects status changes through PATCH", async () => {
    const response = await patchSubmission(
      createRequest(`http://localhost/api/submissions/${pendingSubmissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: pendingSubmissionId }) },
    );

    assert.equal(response.status, 400);
    const body = await readJson(response);
    assert.equal(body.error.code, "invalid_input");
  });

  it("rejects update when Place is missing", async () => {
    const response = await patchSubmission(
      createRequest(`http://localhost/api/submissions/${pendingSubmissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        }),
      }),
      { params: Promise.resolve({ id: pendingSubmissionId }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
    assert.equal(body.error.message, "Place not found");
  });

  it("approves a submission into a new Experience", async () => {
    const seeded = await seedPendingSubmission("Approve into new experience");

    const response = await approveSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/approve`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.status, "approved");
    assert.ok(body.submission.experienceId);
    trackExperienceFromSubmission(body.submission.experienceId);

    const experienceRows = await db
      .select()
      .from(experience)
      .where(eq(experience.id, body.submission.experienceId));
    assert.equal(experienceRows.length, 1);
    assert.equal(experienceRows[0]!.placeId, seeded.placeId);
    assert.equal(experienceRows[0]!.description, seeded.content);
    assert.equal(experienceRows[0]!.goodToKnow, seeded.goodToKnow);

    const preserved = await db
      .select()
      .from(submission)
      .where(eq(submission.id, seeded.id));
    assert.equal(preserved[0]!.content, seeded.content);
  });

  it("approves a submission into an existing Experience", async () => {
    const seeded = await seedPendingSubmission(
      "Approve into existing experience",
    );

    const response = await approveSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceId: existingExperienceId }),
        },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.status, "approved");
    assert.equal(body.submission.experienceId, existingExperienceId);

    const experienceCount = await db
      .select()
      .from(experience)
      .where(eq(experience.id, existingExperienceId));
    assert.equal(experienceCount.length, 1);
  });

  it("rejects approval when Experience is missing", async () => {
    const seeded = await seedPendingSubmission("Approve missing experience");

    const response = await approveSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experienceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          }),
        },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
    assert.equal(body.error.message, "Experience not found");
  });

  it("rejects a pending submission", async () => {
    const seeded = await seedPendingSubmission("Reject me");

    const response = await rejectSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/reject`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.status, "rejected");
    assert.equal(body.submission.experienceId, null);

    const preserved = await db
      .select()
      .from(submission)
      .where(eq(submission.id, seeded.id));
    assert.equal(preserved.length, 1);
    assert.equal(preserved[0]!.content, "Reject me");
  });

  it("merges a submission into an existing Experience", async () => {
    const seeded = await seedPendingSubmission("Merge me");

    const response = await mergeSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceId: existingExperienceId }),
        },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 200);
    const body = await readJson(response);
    assert.equal(body.submission.status, "approved");
    assert.equal(body.submission.experienceId, existingExperienceId);
    assert.equal(body.submission.content, "Merge me");

    const filtered = await listSubmissionsRoute(
      createRequest(
        `http://localhost/api/submissions?experienceId=${existingExperienceId}`,
      ),
    );
    const filteredBody = await readJson(filtered);
    assert.ok(
      filteredBody.submissions.some(
        (item: { id: string }) => item.id === seeded.id,
      ),
    );
  });

  it("rejects merge when Experience is missing", async () => {
    const seeded = await seedPendingSubmission("Merge missing experience");

    const response = await mergeSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${seeded.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experienceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          }),
        },
      ),
      { params: Promise.resolve({ id: seeded.id }) },
    );

    assert.equal(response.status, 404);
    const body = await readJson(response);
    assert.equal(body.error.code, "not_found");
  });

  it("rejects invalid state transitions", async () => {
    const approved = await seedPendingSubmission("Already approved path");
    const approveResponse = await approveSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${approved.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceId: existingExperienceId }),
        },
      ),
      { params: Promise.resolve({ id: approved.id }) },
    );
    assert.equal(approveResponse.status, 200);

    const reapprove = await approveSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${approved.id}/approve`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: approved.id }) },
    );
    assert.equal(reapprove.status, 409);
    assert.equal((await readJson(reapprove)).error.code, "conflict");

    const rejected = await seedPendingSubmission("Already rejected path");
    const rejectResponse = await rejectSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${rejected.id}/reject`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: rejected.id }) },
    );
    assert.equal(rejectResponse.status, 200);

    const rereject = await rejectSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${rejected.id}/reject`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: rejected.id }) },
    );
    assert.equal(rereject.status, 409);

    const remarge = await mergeSubmissionRoute(
      createRequest(
        `http://localhost/api/submissions/${rejected.id}/merge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceId: existingExperienceId }),
        },
      ),
      { params: Promise.resolve({ id: rejected.id }) },
    );
    assert.equal(remarge.status, 409);
  });

  it("returns not found for approve/reject/merge on missing submission", async () => {
    const missingId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    const approve = await approveSubmissionRoute(
      createRequest(`http://localhost/api/submissions/${missingId}/approve`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    assert.equal(approve.status, 404);

    const reject = await rejectSubmissionRoute(
      createRequest(`http://localhost/api/submissions/${missingId}/reject`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    assert.equal(reject.status, 404);

    const merge = await mergeSubmissionRoute(
      createRequest(`http://localhost/api/submissions/${missingId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId: existingExperienceId }),
      }),
      { params: Promise.resolve({ id: missingId }) },
    );
    assert.equal(merge.status, 404);
  });

  it("handles missing user identity at the repository boundary", async () => {
    await assert.rejects(
      () =>
        createSubmission("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", {
          placeId: placeAId,
          content: "No such user",
          goodToKnow: null,
        }),
      (error: unknown) => {
        assert.equal((error as { code?: string }).code, "user_not_found");
        return true;
      },
    );
  });
});
