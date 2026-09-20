import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateCreatePlaceInput,
  validateSlugParam,
  validateUpdatePlaceInput,
} from "../src/lib/places/validation";

describe("validateCreatePlaceInput", () => {
  it("accepts a valid place", () => {
    const result = validateCreatePlaceInput({
      name: "  Blue Ridge  ",
      slug: "blue-ridge",
      city: "Asheville",
      state: "NC",
      latitude: 35.5951,
      longitude: -82.5515,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, {
        name: "Blue Ridge",
        slug: "blue-ridge",
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      });
    }
  });

  it("rejects missing required fields", () => {
    const result = validateCreatePlaceInput({
      name: "Blue Ridge",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details);
      assert.ok(result.details?.slug);
      assert.ok(result.details?.city);
      assert.ok(result.details?.state);
      assert.ok(result.details?.latitude);
      assert.ok(result.details?.longitude);
    }
  });

  it("rejects invalid coordinates", () => {
    const result = validateCreatePlaceInput({
      name: "Blue Ridge",
      slug: "blue-ridge",
      city: "Asheville",
      state: "NC",
      latitude: 120,
      longitude: -200,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.details?.latitude ?? "", /between -90 and 90/);
      assert.match(result.details?.longitude ?? "", /between -180 and 180/);
    }
  });

  it("rejects invalid slug format", () => {
    const result = validateCreatePlaceInput({
      name: "Blue Ridge",
      slug: "Blue Ridge!",
      city: "Asheville",
      state: "NC",
      latitude: 35.5951,
      longitude: -82.5515,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.slug);
    }
  });
});

describe("validateUpdatePlaceInput", () => {
  it("accepts a partial update", () => {
    const result = validateUpdatePlaceInput({
      name: "Updated Name",
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, { name: "Updated Name" });
    }
  });

  it("rejects empty updates", () => {
    const result = validateUpdatePlaceInput({});
    assert.equal(result.ok, false);
  });

  it("rejects invalid coordinate updates", () => {
    const result = validateUpdatePlaceInput({
      latitude: 95,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.details?.latitude);
    }
  });
});

describe("validateSlugParam", () => {
  it("accepts a valid slug", () => {
    const result = validateSlugParam("blue-ridge");
    assert.equal(result.ok, true);
  });

  it("rejects an invalid slug", () => {
    const result = validateSlugParam("Blue Ridge");
    assert.equal(result.ok, false);
  });
});
