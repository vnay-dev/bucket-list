import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateApproveSubmissionInput,
  validateCreateSubmissionInput,
  validateListSubmissionsQuery,
  validateMergeSubmissionInput,
  validateUpdateSubmissionInput,
  validateUuidParam,
} from "../src/lib/submissions/validation";

const validPlaceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const validExperienceId = "11111111-2222-4333-8444-555555555555";

describe("Submission validation", () => {
  it("accepts valid create input", () => {
    const result = validateCreateSubmissionInput({
      placeId: validPlaceId,
      content: "  Try the overlook at sunset  ",
      goodToKnow: "  Bring a jacket  ",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.placeId, validPlaceId);
      assert.equal(result.data.content, "Try the overlook at sunset");
      assert.equal(result.data.goodToKnow, "Bring a jacket");
    }
  });

  it("rejects missing content and placeId", () => {
    const result = validateCreateSubmissionInput({ goodToKnow: "note" });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.content);
      assert.ok(result.details?.placeId);
    }
  });

  it("rejects empty content", () => {
    const result = validateCreateSubmissionInput({
      placeId: validPlaceId,
      content: "   ",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.details?.content, "content is required");
    }
  });

  it("rejects content over max length", () => {
    const result = validateCreateSubmissionInput({
      placeId: validPlaceId,
      content: "a".repeat(10_001),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.details?.content ?? "", /at most 10000/);
    }
  });

  it("rejects userId in create body", () => {
    const result = validateCreateSubmissionInput({
      placeId: validPlaceId,
      content: "A trail walk",
      userId: validPlaceId,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.details?.userId, "unsupported field");
    }
  });

  it("rejects status in update body", () => {
    const result = validateUpdateSubmissionInput({
      content: "Updated",
      status: "approved",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.details?.status, "unsupported field");
    }
  });

  it("accepts partial update", () => {
    const result = validateUpdateSubmissionInput({
      goodToKnow: null,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.goodToKnow, null);
    }
  });

  it("validates list query filters", () => {
    const ok = validateListSubmissionsQuery(
      new URLSearchParams({
        status: "pending",
        placeId: validPlaceId,
        experienceId: validExperienceId,
      }),
    );

    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.data.status, "pending");
      assert.equal(ok.data.placeId, validPlaceId);
      assert.equal(ok.data.experienceId, validExperienceId);
    }

    const bad = validateListSubmissionsQuery(
      new URLSearchParams({ status: "done" }),
    );
    assert.equal(bad.ok, false);
  });

  it("validates approve and merge inputs", () => {
    const approveEmpty = validateApproveSubmissionInput(null);
    assert.equal(approveEmpty.ok, true);

    const approveExisting = validateApproveSubmissionInput({
      experienceId: validExperienceId,
    });
    assert.equal(approveExisting.ok, true);

    const mergeMissing = validateMergeSubmissionInput({});
    assert.equal(mergeMissing.ok, false);

    const mergeOk = validateMergeSubmissionInput({
      experienceId: validExperienceId,
    });
    assert.equal(mergeOk.ok, true);
  });

  it("validates uuid path params", () => {
    const ok = validateUuidParam(validPlaceId, "id", "Invalid submission id");
    assert.equal(ok.ok, true);

    const bad = validateUuidParam("not-a-uuid", "id", "Invalid submission id");
    assert.equal(bad.ok, false);
  });
});
