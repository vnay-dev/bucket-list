import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import {
  resetAuthenticatedUserResolver,
  setAuthenticatedUserResolver,
} from "../src/lib/auth/authenticated-user";
import {
  changeAdminRoleAction,
  grantCuratorAccessAction,
  lookupUserByEmailAction,
  removeCuratorAccessAction,
} from "../src/lib/admin/team-actions";
import {
  isValidEmailFormat,
  normalizeEmailInput,
  parseTeamNotice,
} from "../src/lib/admin/team-helpers";
import { listAdminTeam } from "../src/lib/admin/team";
import { countSuperAdmins } from "../src/lib/auth/users";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

async function asSuperAdmin(input: {
  userId: string;
  email: string;
  name: string;
}) {
  setAuthenticatedUserResolver(async () => ({
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: "superadmin",
  }));
}

describe("team admin helpers", () => {
  it("parses notices and normalizes email", () => {
    assert.equal(parseTeamNotice("curator_added"), "curator_added");
    assert.equal(parseTeamNotice("nope"), null);
    assert.equal(normalizeEmailInput("  Ada@Example.com "), "ada@example.com");
    assert.equal(isValidEmailFormat("ada@example.com"), true);
    assert.equal(isValidEmailFormat("not-an-email"), false);
  });
});

describe("team admin list", () => {
  const suffix = Date.now().toString(36);
  const userIds: string[] = [];

  before(async () => {
    const created = await db
      .insert(user)
      .values([
        {
          name: "Team List Super",
          email: `team-list-super-${suffix}@example.com`,
          role: "superadmin",
        },
        {
          name: "Team List Curator",
          email: `team-list-curator-${suffix}@example.com`,
          role: "curator",
        },
        {
          name: "Team List User",
          email: `team-list-user-${suffix}@example.com`,
          role: "user",
        },
      ])
      .returning();

    for (const row of created) {
      userIds.push(row.id);
    }
  });

  after(async () => {
    for (const id of userIds) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("lists only curator and superadmin accounts", async () => {
    const members = await listAdminTeam();
    assert.ok(
      members.some((member) =>
        member.email.includes(`team-list-super-${suffix}`),
      ),
    );
    assert.ok(
      members.some((member) =>
        member.email.includes(`team-list-curator-${suffix}`),
      ),
    );
    assert.equal(
      members.some((member) =>
        member.email.includes(`team-list-user-${suffix}`),
      ),
      false,
    );
  });
});

describe("team moderation actions", () => {
  const suffix = `${Date.now().toString(36)}-act`;
  const userIds: string[] = [];

  let superAdminId = "";
  let superAdminEmail = "";
  let peerSuperAdminId = "";
  let peerSuperAdminEmail = "";
  let curatorId = "";
  let curatorEmail = "";
  let normalUserId = "";
  let normalUserEmail = "";

  before(async () => {
    const created = await db
      .insert(user)
      .values([
        {
          name: "Team Actor Super",
          email: `team-actor-super-${suffix}@example.com`,
          role: "superadmin",
        },
        {
          name: "Team Actor Super Two",
          email: `team-actor-super-two-${suffix}@example.com`,
          role: "superadmin",
        },
        {
          name: "Team Actor Curator",
          email: `team-actor-curator-${suffix}@example.com`,
          role: "curator",
        },
        {
          name: "Team Actor User",
          email: `team-actor-user-${suffix}@example.com`,
          role: "user",
        },
      ])
      .returning();

    superAdminId = created[0]!.id;
    superAdminEmail = created[0]!.email;
    peerSuperAdminId = created[1]!.id;
    peerSuperAdminEmail = created[1]!.email;
    curatorId = created[2]!.id;
    curatorEmail = created[2]!.email;
    normalUserId = created[3]!.id;
    normalUserEmail = created[3]!.email;
    userIds.push(...created.map((row) => row.id));

    await asSuperAdmin({
      userId: superAdminId,
      email: superAdminEmail,
      name: "Team Actor Super",
    });
  });

  after(async () => {
    resetAuthenticatedUserResolver();
    for (const id of userIds) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("denies unauthenticated, user, and curator access", async () => {
    setAuthenticatedUserResolver(async () => null);
    const unauth = await grantCuratorAccessAction({ email: normalUserEmail });
    assert.equal(unauth.ok, false);
    if (!unauth.ok) assert.equal(unauth.code, "unauthorized");

    setAuthenticatedUserResolver(async () => ({
      userId: normalUserId,
      email: normalUserEmail,
      name: "Team Actor User",
      role: "user",
    }));
    const asUser = await grantCuratorAccessAction({ email: normalUserEmail });
    assert.equal(asUser.ok, false);
    if (!asUser.ok) assert.equal(asUser.code, "forbidden");

    setAuthenticatedUserResolver(async () => ({
      userId: curatorId,
      email: curatorEmail,
      name: "Team Actor Curator",
      role: "curator",
    }));
    const asCurator = await changeAdminRoleAction({
      userId: normalUserId,
      role: "curator",
    });
    assert.equal(asCurator.ok, false);
    if (!asCurator.ok) assert.equal(asCurator.code, "forbidden");

    await asSuperAdmin({
      userId: superAdminId,
      email: superAdminEmail,
      name: "Team Actor Super",
    });
  });

  it("looks up users by email and explains missing accounts", async () => {
    const found = await lookupUserByEmailAction({ email: normalUserEmail });
    assert.equal(found.ok, true);
    if (found.ok) {
      assert.equal(found.user.email, normalUserEmail);
      assert.equal(found.user.role, "user");
    }

    const missing = await lookupUserByEmailAction({
      email: `missing-${suffix}@example.com`,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, "not_found");
      assert.match(missing.message, /sign in with Google/i);
    }
  });

  it("grants curator access and rejects duplicate grants", async () => {
    try {
      await grantCuratorAccessAction({
        email: `  ${normalUserEmail.toUpperCase()}  `,
      });
      assert.fail("expected redirect after grant");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [promoted] = await db
      .select()
      .from(user)
      .where(eq(user.id, normalUserId))
      .limit(1);
    assert.equal(promoted?.role, "curator");

    const duplicate = await grantCuratorAccessAction({ email: normalUserEmail });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.code, "conflict");
      assert.match(duplicate.message, /already a curator/i);
    }
  });

  it("promotes curator to superadmin and demotes when allowed", async () => {
    try {
      await changeAdminRoleAction({
        userId: curatorId,
        role: "superadmin",
      });
      assert.fail("expected redirect after promotion");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [promoted] = await db
      .select()
      .from(user)
      .where(eq(user.id, curatorId))
      .limit(1);
    assert.equal(promoted?.role, "superadmin");

    try {
      await changeAdminRoleAction({
        userId: curatorId,
        role: "curator",
      });
      assert.fail("expected redirect after demotion");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [demoted] = await db
      .select()
      .from(user)
      .where(eq(user.id, curatorId))
      .limit(1);
    assert.equal(demoted?.role, "curator");
  });

  it("removes curator access without deleting the account", async () => {
    // normalUserId is curator from the grant test
    try {
      await removeCuratorAccessAction({ userId: normalUserId });
      assert.fail("expected redirect after remove");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    const [updated] = await db
      .select()
      .from(user)
      .where(eq(user.id, normalUserId))
      .limit(1);
    assert.ok(updated);
    assert.equal(updated.role, "user");
    assert.equal(updated.email, normalUserEmail);
  });

  it("rejects self-demotion and removing a superadmin via remove-access", async () => {
    const selfDemote = await changeAdminRoleAction({
      userId: superAdminId,
      role: "curator",
    });
    assert.equal(selfDemote.ok, false);
    if (!selfDemote.ok) {
      assert.equal(selfDemote.code, "conflict");
      assert.match(selfDemote.message, /own superadmin access/i);
    }

    const removeSuper = await removeCuratorAccessAction({
      userId: peerSuperAdminId,
    });
    assert.equal(removeSuper.ok, false);
    if (!removeSuper.ok) {
      assert.equal(removeSuper.code, "invalid_input");
      assert.match(removeSuper.message, /Demote this superadmin/i);
    }
  });

  it("protects the last remaining superadmin from demotion", async () => {
    // Ensure exactly two superadmins: actor + peer
    await db
      .update(user)
      .set({ role: "superadmin" })
      .where(eq(user.id, superAdminId));
    await db
      .update(user)
      .set({ role: "superadmin" })
      .where(eq(user.id, peerSuperAdminId));

    await asSuperAdmin({
      userId: superAdminId,
      email: superAdminEmail,
      name: "Team Actor Super",
    });

    try {
      await changeAdminRoleAction({
        userId: peerSuperAdminId,
        role: "curator",
      });
      assert.fail("expected redirect after demoting peer");
    } catch (error) {
      assert.equal(isRedirectError(error), true);
    }

    assert.equal(await countSuperAdmins(), 1);

    // Actor is now the only superadmin — self-demotion rejected
    const lastSelf = await changeAdminRoleAction({
      userId: superAdminId,
      role: "curator",
    });
    assert.equal(lastSelf.ok, false);
    if (!lastSelf.ok) {
      assert.equal(lastSelf.code, "conflict");
    }

    // Authenticate as peer (curator) cannot demote; re-promote peer and
    // make peer the sole superadmin to test last-superadmin demotion by another.
    await db
      .update(user)
      .set({ role: "curator" })
      .where(eq(user.id, superAdminId));
    await db
      .update(user)
      .set({ role: "superadmin" })
      .where(eq(user.id, peerSuperAdminId));

    await asSuperAdmin({
      userId: peerSuperAdminId,
      email: peerSuperAdminEmail,
      name: "Team Actor Super Two",
    });

    assert.equal(await countSuperAdmins(), 1);

    const lastPeer = await changeAdminRoleAction({
      userId: peerSuperAdminId,
      role: "curator",
    });
    assert.equal(lastPeer.ok, false);
    if (!lastPeer.ok) {
      assert.equal(lastPeer.code, "conflict");
      assert.match(
        lastPeer.message,
        /last remaining superadmin|own superadmin access/i,
      );
    }

    // Restore actor for cleanup
    await db
      .update(user)
      .set({ role: "superadmin" })
      .where(eq(user.id, superAdminId));
    await asSuperAdmin({
      userId: superAdminId,
      email: superAdminEmail,
      name: "Team Actor Super",
    });
  });
});
