import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateAssignTagsInput,
  validateCreateExperienceInput,
  validateListExperiencesQuery,
  validateUpdateExperienceInput,
  validateUuidParam,
} from "../src/lib/experiences/validation";

const validPlaceId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const validTagId = "11111111-1111-4111-8111-111111111111";

describe("validateCreateExperienceInput", () => {
  it("accepts a valid experience", () => {
    const result = validateCreateExperienceInput({
      placeId: validPlaceId,
      title: "  Sunset Overlook  ",
      description: "  Watch the sun set  ",
      goodToKnow: "  Arrive early  ",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        placeId: validPlaceId,
        title: "Sunset Overlook",
        description: "Watch the sun set",
        goodToKnow: "Arrive early",
      });
    }
  });

  it("rejects missing required fields", () => {
    const result = validateCreateExperienceInput({
      description: "Only description",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.placeId);
      assert.ok(result.details?.title);
    }
  });

  it("rejects invalid placeId", () => {
    const result = validateCreateExperienceInput({
      placeId: "not-a-uuid",
      title: "Title",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.placeId);
    }
  });

  it("rejects oversized title", () => {
    const result = validateCreateExperienceInput({
      placeId: validPlaceId,
      title: "a".repeat(201),
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.title);
    }
  });
});

describe("validateUpdateExperienceInput", () => {
  it("accepts a partial update", () => {
    const result = validateUpdateExperienceInput({
      title: "Updated Title",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, { title: "Updated Title" });
    }
  });

  it("rejects empty updates", () => {
    const result = validateUpdateExperienceInput({});
    assert.equal(result.ok, false);
  });

  it("allows clearing optional fields with null", () => {
    const result = validateUpdateExperienceInput({
      description: null,
      goodToKnow: null,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        description: null,
        goodToKnow: null,
      });
    }
  });

  it("rejects unsupported fields", () => {
    const result = validateUpdateExperienceInput({
      unknown: "value",
    });

    assert.equal(result.ok, false);
  });
});

describe("validateListExperiencesQuery", () => {
  it("accepts a missing placeId", () => {
    const result = validateListExperiencesQuery(new URLSearchParams());
    assert.equal(result.ok, true);
  });

  it("accepts a valid placeId", () => {
    const result = validateListExperiencesQuery(
      new URLSearchParams({ placeId: validPlaceId }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.placeId, validPlaceId);
    }
  });

  it("rejects an invalid placeId", () => {
    const result = validateListExperiencesQuery(
      new URLSearchParams({ placeId: "bad" }),
    );
    assert.equal(result.ok, false);
  });
});

describe("validateAssignTagsInput", () => {
  it("accepts one or more tag ids", () => {
    const result = validateAssignTagsInput({
      tagIds: [validTagId, "22222222-2222-4222-8222-222222222222"],
    });

    assert.equal(result.ok, true);
  });

  it("rejects an empty tagIds array", () => {
    const result = validateAssignTagsInput({ tagIds: [] });
    assert.equal(result.ok, false);
  });

  it("rejects invalid tag ids", () => {
    const result = validateAssignTagsInput({ tagIds: ["bad"] });
    assert.equal(result.ok, false);
  });
});

describe("validateUuidParam", () => {
  it("accepts a valid uuid", () => {
    const result = validateUuidParam(validPlaceId, "id", "Invalid id");
    assert.equal(result.ok, true);
  });

  it("rejects an invalid uuid", () => {
    const result = validateUuidParam("not-valid", "id", "Invalid id");
    assert.equal(result.ok, false);
  });
});
