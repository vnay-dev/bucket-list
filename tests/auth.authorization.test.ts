import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
  requireCurator,
  requireSuperAdmin,
  resetAuthenticatedUserResolver,
  setAuthenticatedUserResolver,
  type AuthenticatedUser,
} from "../src/lib/auth/authenticated-user";
import { AuthorizationError } from "../src/lib/auth/errors";
import {
  canAccessCurator,
  canAccessSuperAdmin,
  roleAtLeast,
} from "../src/lib/auth/roles";
import { POST as createSubmissionRoute } from "../src/app/api/submissions/route";
import { createSubmission } from "../src/lib/submissions/repository";
import { db } from "../src/db";
import { place, submission, user } from "../src/db/schema";
import { eq } from "drizzle-orm";

function userFixture(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "user@example.com",
    name: "Test User",
    role: "user",
    ...overrides,
  };
}

describe("role hierarchy", () => {
  it("ranks roles correctly", () => {
    assert.equal(roleAtLeast("user", "user"), true);
    assert.equal(roleAtLeast("curator", "user"), true);
    assert.equal(roleAtLeast("superadmin", "curator"), true);
    assert.equal(roleAtLeast("user", "curator"), false);
    assert.equal(roleAtLeast("curator", "superadmin"), false);
  });

  it("allows curator and superadmin into curator areas", () => {
    assert.equal(canAccessCurator("user"), false);
    assert.equal(canAccessCurator("curator"), true);
    assert.equal(canAccessCurator("superadmin"), true);
  });

  it("allows only superadmin into superadmin areas", () => {
    assert.equal(canAccessSuperAdmin("user"), false);
    assert.equal(canAccessSuperAdmin("curator"), false);
    assert.equal(canAccessSuperAdmin("superadmin"), true);
  });
});

describe("authorization helpers", () => {
  afterEach(() => {
    resetAuthenticatedUserResolver();
  });

  it("returns null for unauthenticated callers", async () => {
    setAuthenticatedUserResolver(async () => null);
    assert.equal(await getAuthenticatedUser(), null);
  });

  it("requireAuthenticatedUser throws 401 when unauthenticated", async () => {
    setAuthenticatedUserResolver(async () => null);

    await assert.rejects(
      () => requireAuthenticatedUser(),
      (error: unknown) => {
        assert.ok(error instanceof AuthorizationError);
        assert.equal(error.code, "unauthorized");
        assert.equal(error.status, 401);
        return true;
      },
    );
  });

  it("requireAuthenticatedUser returns a normal user", async () => {
    const expected = userFixture({ role: "user" });
    setAuthenticatedUserResolver(async () => expected);
    assert.deepEqual(await requireAuthenticatedUser(), expected);
  });

  it("requireCurator allows curator", async () => {
    const expected = userFixture({ role: "curator" });
    setAuthenticatedUserResolver(async () => expected);
    assert.deepEqual(await requireCurator(), expected);
  });

  it("requireCurator allows superadmin", async () => {
    const expected = userFixture({ role: "superadmin" });
    setAuthenticatedUserResolver(async () => expected);
    assert.deepEqual(await requireCurator(), expected);
  });

  it("requireCurator forbids a normal user", async () => {
    setAuthenticatedUserResolver(async () => userFixture({ role: "user" }));

    await assert.rejects(
      () => requireCurator(),
      (error: unknown) => {
        assert.ok(error instanceof AuthorizationError);
        assert.equal(error.code, "forbidden");
        assert.equal(error.status, 403);
        return true;
      },
    );
  });

  it("requireSuperAdmin allows superadmin", async () => {
    const expected = userFixture({ role: "superadmin" });
    setAuthenticatedUserResolver(async () => expected);
    assert.deepEqual(await requireSuperAdmin(), expected);
  });

  it("requireSuperAdmin forbids curator", async () => {
    setAuthenticatedUserResolver(async () =>
      userFixture({ role: "curator", email: "curator@example.com" }),
    );

    await assert.rejects(
      () => requireSuperAdmin(),
      (error: unknown) => {
        assert.ok(error instanceof AuthorizationError);
        assert.equal(error.code, "forbidden");
        assert.equal(error.status, 403);
        return true;
      },
    );
  });

  it("requireSuperAdmin forbids a normal user", async () => {
    setAuthenticatedUserResolver(async () => userFixture({ role: "user" }));

    await assert.rejects(
      () => requireSuperAdmin(),
      (error: unknown) => {
        assert.ok(error instanceof AuthorizationError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );
  });
});

describe("submission create uses authenticated identity", () => {
  afterEach(() => {
    resetAuthenticatedUserResolver();
  });

  it("creates a submission with the authenticated userId, not a body userId", async () => {
    const suffix = Date.now().toString(36);
    const email = `auth-sub-${suffix}@example.com`;

    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Auth Submission User",
        email,
        role: "user",
      })
      .returning();

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Auth Submission Place",
        slug: `auth-sub-place-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();

    setAuthenticatedUserResolver(async () => ({
      userId: seededUser.id,
      email: seededUser.email,
      name: seededUser.name,
      role: "user",
    }));

    const response = await createSubmissionRoute(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId: seededPlace.id,
          content: "Hike the ridge at sunrise",
          goodToKnow: "Bring layers",
          userId: "99999999-9999-4999-8999-999999999999",
        }),
      }),
    );

    // userId in body is rejected by validation as unsupported field
    assert.equal(response.status, 400);

    const allowedResponse = await createSubmissionRoute(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId: seededPlace.id,
          content: "Hike the ridge at sunrise",
          goodToKnow: "Bring layers",
        }),
      }),
    );

    assert.equal(allowedResponse.status, 201);
    const body = (await allowedResponse.json()) as {
      submission: { id: string; userId: string };
    };
    assert.equal(body.submission.userId, seededUser.id);

    await db.delete(submission).where(eq(submission.id, body.submission.id));
    await db.delete(place).where(eq(place.id, seededPlace.id));
    await db.delete(user).where(eq(user.id, seededUser.id));
  });

  it("still rejects unauthenticated HTTP create", async () => {
    setAuthenticatedUserResolver(async () => null);

    const response = await createSubmissionRoute(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId: "11111111-1111-4111-8111-111111111111",
          content: "Should not create",
        }),
      }),
    );

    assert.equal(response.status, 401);
    const body = (await response.json()) as {
      error: { code: string };
    };
    assert.equal(body.error.code, "unauthorized");
  });
});

describe("upsertUserFromGoogle role safety", () => {
  it("does not downgrade an existing curator on subsequent sign-in", async () => {
    const { upsertUserFromGoogle } = await import("../src/lib/auth/users");
    const suffix = Date.now().toString(36);
    const email = `role-safe-${suffix}@example.com`;

    const [seeded] = await db
      .insert(user)
      .values({
        name: "Curator Keep",
        email,
        role: "curator",
        avatar: "https://example.com/old.png",
      })
      .returning();

    const resolved = await upsertUserFromGoogle({
      email,
      name: "Updated Name",
      avatar: "https://example.com/new.png",
    });

    assert.equal(resolved.id, seeded.id);
    assert.equal(resolved.role, "curator");
    assert.equal(resolved.name, "Updated Name");
    assert.equal(resolved.avatar, "https://example.com/new.png");

    await db.delete(user).where(eq(user.id, seeded.id));
  });
});

describe("createSubmission repository identity contract", () => {
  it("persists the caller-supplied userId from the auth layer", async () => {
    const suffix = Date.now().toString(36);

    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Repo Auth User",
        email: `repo-auth-${suffix}@example.com`,
        role: "user",
      })
      .returning();

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Repo Auth Place",
        slug: `repo-auth-place-${suffix}`,
        city: "Durham",
        state: "NC",
        latitude: 35.994,
        longitude: -78.8986,
      })
      .returning();

    const created = await createSubmission(seededUser.id, {
      placeId: seededPlace.id,
      content: "From authenticated caller",
      goodToKnow: null,
    });

    assert.equal(created.userId, seededUser.id);

    await db.delete(submission).where(eq(submission.id, created.id));
    await db.delete(place).where(eq(place.id, seededPlace.id));
    await db.delete(user).where(eq(user.id, seededUser.id));
  });
});
