import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { place, submission, user } from "../src/db/schema";
import { getDashboardOverview } from "../src/lib/admin/dashboard";
import {
  getAdminNavItems,
  isAdminNavActive,
} from "../src/lib/admin/navigation";
import {
  formatRoleLabel,
  getInitials,
  truncateText,
} from "../src/lib/admin/presentation";
import { createSubmission } from "../src/lib/submissions/repository";

describe("admin navigation", () => {
  it("hides Team from curators and shows it to superadmins", () => {
    const curatorNav = getAdminNavItems("curator");
    const superadminNav = getAdminNavItems("superadmin");

    assert.equal(
      curatorNav.some((item) => item.href === "/admin/team"),
      false,
    );
    assert.equal(
      superadminNav.some((item) => item.href === "/admin/team"),
      true,
    );
  });

  it("includes the core curation destinations for every admin role", () => {
    const labels = getAdminNavItems("curator").map((item) => item.label);
    assert.deepEqual(labels, [
      "Dashboard",
      "Submissions",
      "Experiences",
      "Places",
      "Tags",
    ]);
  });

  it("matches active routes without treating Dashboard as a prefix", () => {
    assert.equal(
      isAdminNavActive("/admin", { href: "/admin", label: "Dashboard", exact: true }),
      true,
    );
    assert.equal(
      isAdminNavActive("/admin/submissions", {
        href: "/admin",
        label: "Dashboard",
        exact: true,
      }),
      false,
    );
    assert.equal(
      isAdminNavActive("/admin/submissions", {
        href: "/admin/submissions",
        label: "Submissions",
      }),
      true,
    );
  });
});

describe("admin presentation helpers", () => {
  it("formats initials and role labels", () => {
    assert.equal(getInitials("Ada Lovelace"), "AL");
    assert.equal(getInitials("Prince"), "PR");
    assert.equal(formatRoleLabel("superadmin"), "Superadmin");
    assert.equal(formatRoleLabel("curator"), "Curator");
  });

  it("truncates long submission previews", () => {
    assert.equal(truncateText("Short note", 40), "Short note");
    assert.equal(
      truncateText("A very long submission that should be shortened for the list", 24),
      "A very long submission…",
    );
  });
});

describe("admin dashboard overview", () => {
  const suffix = Date.now().toString(36);
  const createdPlaceIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdSubmissionIds: string[] = [];

  before(async () => {
    const [seededUser] = await db
      .insert(user)
      .values({
        name: "Dashboard Seed User",
        email: `dashboard-${suffix}@example.com`,
        role: "user",
      })
      .returning();
    createdUserIds.push(seededUser.id);

    const [seededPlace] = await db
      .insert(place)
      .values({
        name: "Dashboard Seed Place",
        slug: `dashboard-seed-${suffix}`,
        city: "Asheville",
        state: "NC",
        latitude: 35.5951,
        longitude: -82.5515,
      })
      .returning();
    createdPlaceIds.push(seededPlace.id);

    const pending = await createSubmission(seededUser.id, {
      placeId: seededPlace.id,
      content: "Pending item for dashboard preview",
      goodToKnow: null,
    });
    createdSubmissionIds.push(pending.id);
  });

  after(async () => {
    for (const id of createdSubmissionIds) {
      await db.delete(submission).where(eq(submission.id, id));
    }
    for (const id of createdPlaceIds) {
      await db.delete(place).where(eq(place.id, id));
    }
    for (const id of createdUserIds) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("returns live counts and includes pending submissions with place context", async () => {
    const overview = await getDashboardOverview();

    assert.ok(overview.counts.pendingSubmissions >= 1);
    assert.ok(overview.counts.places >= 1);
    assert.ok(typeof overview.counts.experiences === "number");
    assert.ok(typeof overview.counts.tags === "number");

    const seeded = overview.pendingSubmissions.find((item) =>
      createdSubmissionIds.includes(item.id),
    );
    assert.ok(seeded);
    assert.equal(seeded.placeName, "Dashboard Seed Place");
    assert.equal(seeded.placeLocation, "Asheville, NC");
    assert.match(seeded.content, /Pending item/);
  });
});
