import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { experience, place, submission, user } from "../src/db/schema";
import {
  setAuthenticatedUserResolver,
  resetAuthenticatedUserResolver,
} from "../src/lib/auth/authenticated-user";
import {
  approveEditedSubmissionAction,
  mergeSubmissionAction,
  rejectSubmissionAction,
} from "../src/lib/admin/submission-actions";
import {
  formatSubmissionStatus,
  parseSubmissionNotice,
  parseSubmissionStatusFilter,
  suggestExperienceTitle,
  submissionNoticeMessage,
} from "../src/lib/admin/submission-helpers";
import {
  getSubmissionReviewData,
  listAdminSubmissions,
} from "../src/lib/admin/submissions";
import { createSubmission } from "../src/lib/submissions/repository";
import { createExperience } from "../src/lib/experiences/repository";

function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  ) {
    return true;
  }

  return false;
}

describe("submission admin helpers", () => {
  it("defaults status filter to pending and accepts known values", () => {
    assert.equal(parseSubmissionStatusFilter(undefined), "pending");
    assert.equal(parseSubmissionStatusFilter("approved"), "approved");
    assert.equal(parseSubmissionStatusFilter("rejected"), "rejected");
    assert.equal(parseSubmissionStatusFilter("nope"), "pending");
  });

  it("parses notices and formats status labels", () => {
    assert.equal(parseSubmissionNotice("approved"), "approved");
    assert.equal(parseSubmissionNotice("nope"), null);
    assert.equal(formatSubmissionStatus("pending"), "Pending");
    assert.match(submissionNoticeMessage("merged"), /merged/i);
  });

  it("suggests an experience title from submission content", () => {
    assert.equal(
      suggestExperienceTitle("Hike the ridge\nBring water"),
      "Hike the ridge",
    );
    assert.equal(suggestExperienceTitle("x".repeat(250)).length, 200);
  });
});

describe("submission admin list and review data", () => {
  const suffix = Date.now().toString(36);
  const placeIds: string[] = [];
  const userIds: string[] = [];
  const submissionIds: string[] = [];
  const experienceIds: string[] = [];

  let placeId = "";
  let userId = "";
  let pendingId = "";
  let approvedId = "";

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Review Queue User",
        email: `review-queue-${suffix}@example.com`,
        role: "user",
      })
      .returning();
    userId = seededUser.id;
    userIds.push(userId);

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Review Queue Place",
        slug: `review-queue-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    placeId = seededPlace.id;
    placeIds.push(placeId);

    const pending = await createSubmission(userId, {
      placeId,
      content: "Oldest pending for list",
      goodToKnow: "Wear boots",
    });
    pendingId = pending.id;
    submissionIds.push(pendingId);

    const approved = await createSubmission(userId, {
      placeId,
      content: "Already approved content",
      goodToKnow: null,
    });
    approvedId = approved.id;
    submissionIds.push(approvedId);

    const createdExperience = await createExperience({
      placeId,
      title: "Existing Trail",
      description: "A known trail",
      goodToKnow: null,
    });
    experienceIds.push(createdExperience.id);

    await db
      .update(submission)
      .set({
        status: "approved",
        experienceId: createdExperience.id,
      })
      .where(eq(submission.id, approvedId));
  });

  after(async () => {
    resetAuthenticatedUserResolver();
    for (const id of submissionIds) {
      await db.delete(submission).where(eq(submission.id, id));
    }
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

  it("lists pending submissions with place context", async () => {
    const items = await listAdminSubmissions("pending");
    const match = items.find((item) => item.id === pendingId);
    assert.ok(match);
    assert.equal(match.placeName, "Review Queue Place");
    assert.equal(match.placeLocation, "Asheville, NC");
    assert.equal(match.goodToKnow, "Wear boots");
    assert.equal(match.status, "pending");
  });

  it("filters approved submissions separately from pending", async () => {
    const pending = await listAdminSubmissions("pending");
    const approved = await listAdminSubmissions("approved");
    assert.equal(
      pending.some((item) => item.id === approvedId),
      false,
    );
    assert.equal(
      approved.some((item) => item.id === approvedId),
      true,
    );
  });

  it("loads submission review data including places and experiences", async () => {
    const data = await getSubmissionReviewData(pendingId);
    assert.ok(data);
    assert.equal(data.submission.id, pendingId);
    assert.equal(data.place.name, "Review Queue Place");
    assert.ok(data.places.length >= 1);
    assert.ok(data.experiences.some((item) => item.title === "Existing Trail"));
  });

  it("returns null for a missing submission detail", async () => {
    const data = await getSubmissionReviewData(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    assert.equal(data, null);
  });
});

describe("submission moderation actions", () => {
  const suffix = `${Date.now().toString(36)}-act`;
  const placeIds: string[] = [];
  const userIds: string[] = [];
  const submissionIds: string[] = [];
  const experienceIds: string[] = [];

  let placeId = "";
  let userId = "";

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Action Curator Seed",
        email: `action-seed-${suffix}@example.com`,
        role: "curator",
      })
      .returning();
    userId = seededUser.id;
    userIds.push(userId);

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Action Place",
        slug: `action-place-${suffix}`,
        city: "Durham",
        state: "NC",
        latitude: 35.994,
        longitude: -78.8986,
      })
      .returning();
    placeId = seededPlace.id;
    placeIds.push(placeId);

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `action-seed-${suffix}@example.com`,
      name: "Action Curator Seed",
      role: "curator",
    }));
  });

  after(async () => {
    resetAuthenticatedUserResolver();
    for (const id of submissionIds) {
      await db.delete(submission).where(eq(submission.id, id));
    }
    for (const id of experienceIds) {
      await db.delete(experience).where(eq(experience.id, id));
    }
    if (placeId) {
      const leftoverExperiences = await db
        .select({ id: experience.id })
        .from(experience)
        .where(eq(experience.placeId, placeId));
      for (const row of leftoverExperiences) {
        await db.delete(experience).where(eq(experience.id, row.id));
      }
    }
    for (const id of placeIds) {
      await db.delete(place).where(eq(place.id, id));
    }
    for (const id of userIds) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("rejects unauthenticated moderation attempts", async () => {
    setAuthenticatedUserResolver(async () => null);
    const created = await createSubmission(userId, {
      placeId,
      content: "Should not approve without auth",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    const result = await approveEditedSubmissionAction({
      submissionId: created.id,
      title: "Nope",
      description: "Nope",
      goodToKnow: "",
      placeId,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "unauthorized");
    }

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `action-seed-${suffix}@example.com`,
      name: "Action Curator Seed",
      role: "curator",
    }));
  });

  it("returns validation errors for empty edit fields", async () => {
    const created = await createSubmission(userId, {
      placeId,
      content: "Needs curated title",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    const result = await approveEditedSubmissionAction({
      submissionId: created.id,
      title: "   ",
      description: "",
      goodToKnow: "",
      placeId,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "invalid_input");
      assert.ok(result.fieldErrors?.title);
      assert.ok(result.fieldErrors?.description);
    }
  });

  it("approves a submission into a curated experience", async () => {
    const created = await createSubmission(userId, {
      placeId,
      content: "Original contributor wording that stays preserved",
      goodToKnow: "Original tip",
    });
    submissionIds.push(created.id);

    try {
      await approveEditedSubmissionAction({
        submissionId: created.id,
        title: "Curated Ridge Walk",
        description: "Polished public description",
        goodToKnow: "Arrive early",
        placeId,
      });
      assert.fail("expected redirect after approve");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, created.id))
      .limit(1);

    assert.equal(row.status, "approved");
    assert.ok(row.experienceId);
    assert.equal(row.content, "Original contributor wording that stays preserved");
    experienceIds.push(row.experienceId);

    const [experienceRow] = await db
      .select()
      .from(experience)
      .where(eq(experience.id, row.experienceId!))
      .limit(1);

    assert.equal(experienceRow.title, "Curated Ridge Walk");
    assert.equal(experienceRow.description, "Polished public description");
    assert.equal(experienceRow.goodToKnow, "Arrive early");
  });

  it("merges a submission into an existing experience", async () => {
    const existing = await createExperience({
      placeId,
      title: "Merge Target",
      description: "Already published",
      goodToKnow: null,
    });
    experienceIds.push(existing.id);

    const created = await createSubmission(userId, {
      placeId,
      content: "Duplicate suggestion",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    try {
      await mergeSubmissionAction({
        submissionId: created.id,
        experienceId: existing.id,
      });
      assert.fail("expected redirect after merge");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, created.id))
      .limit(1);

    assert.equal(row.status, "approved");
    assert.equal(row.experienceId, existing.id);
  });

  it("rejects a pending submission without deleting it", async () => {
    const created = await createSubmission(userId, {
      placeId,
      content: "Not a fit",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    try {
      await rejectSubmissionAction({ submissionId: created.id });
      assert.fail("expected redirect after reject");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [row] = await db
      .select()
      .from(submission)
      .where(eq(submission.id, created.id))
      .limit(1);

    assert.equal(row.status, "rejected");
    assert.equal(row.content, "Not a fit");
  });

  it("returns conflict when approving an already processed submission", async () => {
    const created = await createSubmission(userId, {
      placeId,
      content: "Process once",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    try {
      await rejectSubmissionAction({ submissionId: created.id });
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const result = await approveEditedSubmissionAction({
      submissionId: created.id,
      title: "Too late",
      description: "Too late",
      goodToKnow: "",
      placeId,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "conflict");
    }
  });

  it("forbids normal users from moderation actions", async () => {
    setAuthenticatedUserResolver(async () => ({
      userId,
      email: "user-only@example.com",
      name: "Normal User",
      role: "user",
    }));

    const created = await createSubmission(userId, {
      placeId,
      content: "Forbidden path",
      goodToKnow: null,
    });
    submissionIds.push(created.id);

    const result = await rejectSubmissionAction({
      submissionId: created.id,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "forbidden");
    }

    setAuthenticatedUserResolver(async () => ({
      userId,
      email: `action-seed-${suffix}@example.com`,
      name: "Action Curator Seed",
      role: "curator",
    }));
  });
});
