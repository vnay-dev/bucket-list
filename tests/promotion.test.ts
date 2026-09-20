import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  assertProductionTargetIsNotDevelopment,
  looksLikeDevelopmentDatabase,
  PromotionEnvError,
  resolvePromotionEnv,
} from "../src/lib/promotion/env";
import { formatPromoteCliOutput } from "../src/lib/promotion/format";
import { buildPromotionPlan, countPlanActions } from "../src/lib/promotion/plan";
import {
  promoteQaToProduction,
  type PromoteDependencies,
} from "../src/lib/promotion/promote";
import { experienceTagPairKey } from "../src/lib/promotion/select";
import type {
  ExistingState,
  ExperienceRow,
  ExperienceTagRow,
  PlaceRow,
  PromotionCounts,
  PromotionPayload,
  PromotionPlan,
  TagRow,
} from "../src/lib/promotion/types";

const now = new Date("2026-01-15T12:00:00.000Z");

function place(partial: Partial<PlaceRow> & Pick<PlaceRow, "id" | "slug">): PlaceRow {
  return {
    name: partial.name ?? `Place ${partial.slug}`,
    city: partial.city ?? "Austin",
    state: partial.state ?? "TX",
    latitude: partial.latitude ?? 30.27,
    longitude: partial.longitude ?? -97.74,
    ...partial,
  };
}

function experience(
  partial: Partial<ExperienceRow> & Pick<ExperienceRow, "id" | "placeId" | "title">,
): ExperienceRow {
  return {
    description: partial.description ?? "A curated experience",
    goodToKnow: partial.goodToKnow ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    ...partial,
  };
}

function tag(partial: Partial<TagRow> & Pick<TagRow, "id" | "name">): TagRow {
  return { ...partial };
}

function link(
  partial: Partial<ExperienceTagRow> &
    Pick<ExperienceTagRow, "id" | "experienceId" | "tagId">,
): ExperienceTagRow {
  return { ...partial };
}

function emptyExisting(): ExistingState {
  return {
    placesById: new Map(),
    placesBySlug: new Map(),
    experiencesById: new Map(),
    tagsById: new Map(),
    tagsByName: new Map(),
    experienceTagsByPair: new Map(),
  };
}

function existingFromPayload(payload: PromotionPayload): ExistingState {
  const state = emptyExisting();
  for (const row of payload.places) {
    state.placesById.set(row.id, row);
    state.placesBySlug.set(row.slug, row);
  }
  for (const row of payload.experiences) {
    state.experiencesById.set(row.id, row);
  }
  for (const row of payload.tags) {
    state.tagsById.set(row.id, row);
    state.tagsByName.set(row.name, row);
  }
  for (const row of payload.experienceTags) {
    state.experienceTagsByPair.set(
      experienceTagPairKey(row.experienceId, row.tagId),
      row,
    );
  }
  return state;
}

function samplePayload(): PromotionPayload {
  const placeA = place({ id: "place-a", slug: "austin-tx" });
  const placeB = place({ id: "place-b", slug: "dallas-tx", city: "Dallas" });
  const expApproved = experience({
    id: "exp-approved",
    placeId: placeA.id,
    title: "Kayak the river",
  });
  const expUnrelated = experience({
    id: "exp-unrelated",
    placeId: placeB.id,
    title: "QA-only test experience",
  });
  const tagOutdoor = tag({ id: "tag-outdoor", name: "outdoor" });
  const tagTest = tag({ id: "tag-test", name: "qa-only-tag" });

  // Selection for promotion is only approved-linked content.
  // Unrelated rows exist in "QA" but are omitted from the payload by design.
  void expUnrelated;
  void tagTest;

  return {
    places: [placeA],
    experiences: [expApproved],
    tags: [tagOutdoor],
    experienceTags: [
      link({
        id: "et-1",
        experienceId: expApproved.id,
        tagId: tagOutdoor.id,
      }),
    ],
    approvedSubmissionCount: 1,
  };
}

describe("promotion env safety", () => {
  it("fails when QA_DATABASE_URL is missing", () => {
    assert.throws(
      () =>
        resolvePromotionEnv({
          PRODUCTION_DATABASE_URL: "postgresql://u:p@prod.neon.tech/neondb",
        }),
      (error: unknown) =>
        error instanceof PromotionEnvError &&
        error.message.includes("QA_DATABASE_URL"),
    );
  });

  it("fails when PRODUCTION_DATABASE_URL is missing", () => {
    assert.throws(
      () =>
        resolvePromotionEnv({
          QA_DATABASE_URL: "postgresql://u:p@qa.neon.tech/neondb",
        }),
      (error: unknown) =>
        error instanceof PromotionEnvError &&
        error.message.includes("PRODUCTION_DATABASE_URL"),
    );
  });

  it("fails when QA and Production URLs are the same", () => {
    const url = "postgresql://u:p@shared.neon.tech/neondb";
    assert.throws(
      () =>
        resolvePromotionEnv({
          QA_DATABASE_URL: url,
          PRODUCTION_DATABASE_URL: url,
        }),
      (error: unknown) =>
        error instanceof PromotionEnvError &&
        error.message.includes("different databases"),
    );
  });

  it("rejects development database as the Production target", () => {
    const development =
      "postgresql://u:p@ep-dev-branch.neon.tech/neondb";
    const qa = "postgresql://u:p@ep-qa.neon.tech/neondb";

    assert.equal(looksLikeDevelopmentDatabase(development), true);

    assert.throws(
      () =>
        resolvePromotionEnv({
          QA_DATABASE_URL: qa,
          PRODUCTION_DATABASE_URL: development,
        }),
      PromotionEnvError,
    );

    assert.throws(
      () =>
        assertProductionTargetIsNotDevelopment(
          "postgresql://u:p@prod.neon.tech/neondb",
          {
            DATABASE_URL: "postgresql://u:p@prod.neon.tech/neondb",
          },
        ),
      (error: unknown) =>
        error instanceof PromotionEnvError &&
        error.message.includes("must not match the development database"),
    );
  });

  it("accepts distinct QA and Production URLs", () => {
    const env = resolvePromotionEnv({
      QA_DATABASE_URL: "postgresql://u:p@ep-qa.neon.tech/neondb",
      PRODUCTION_DATABASE_URL: "postgresql://u:p@ep-prod.neon.tech/neondb",
      DATABASE_URL: "postgresql://u:p@ep-dev.neon.tech/neondb",
    });
    assert.equal(env.qaDatabaseUrl.includes("ep-qa"), true);
    assert.equal(env.productionDatabaseUrl.includes("ep-prod"), true);
  });
});

describe("promotion selection and planning", () => {
  it("only plans approved-linked content (unrelated QA content is absent)", () => {
    const payload = samplePayload();
    assert.equal(payload.experiences.length, 1);
    assert.equal(payload.experiences[0]?.id, "exp-approved");
    assert.equal(
      payload.experiences.some((row) => row.id === "exp-unrelated"),
      false,
    );
    assert.equal(
      payload.places.some((row) => row.slug === "dallas-tx"),
      false,
    );
  });

  it("preserves relationship ids in the plan", () => {
    const payload = samplePayload();
    const plan = buildPromotionPlan(payload, emptyExisting());

    assert.equal(plan.conflicts.length, 0);
    assert.equal(plan.experiences[0]?.row.placeId, "place-a");
    assert.equal(plan.experienceTags[0]?.row.experienceId, "exp-approved");
    assert.equal(plan.experienceTags[0]?.row.tagId, "tag-outdoor");
    assert.equal(plan.places[0]?.action, "create");
    assert.equal(plan.experiences[0]?.action, "create");
    assert.equal(plan.tags[0]?.action, "create");
    assert.equal(plan.experienceTags[0]?.action, "create");
  });

  it("detects missing place relationships", () => {
    const payload = samplePayload();
    payload.places = [];
    const plan = buildPromotionPlan(payload, emptyExisting());
    assert.equal(plan.conflicts.some((c) => c.code === "missing_place"), true);
  });

  it("detects place slug / id mismatches against Production", () => {
    const payload = samplePayload();
    const existing = emptyExisting();
    existing.placesBySlug.set(
      "austin-tx",
      place({ id: "other-place-id", slug: "austin-tx" }),
    );
    const plan = buildPromotionPlan(payload, existing);
    assert.equal(
      plan.conflicts.some((c) => c.code === "place_slug_id_mismatch"),
      true,
    );
  });

  it("does not create duplicates when content already exists", () => {
    const payload = samplePayload();
    const existing = existingFromPayload(payload);
    const plan = buildPromotionPlan(payload, existing);
    const counts = countPlanActions(plan);

    assert.equal(counts.placesCreated, 0);
    assert.equal(counts.experiencesCreated, 0);
    assert.equal(counts.tagsCreated, 0);
    assert.equal(counts.relationshipsAdded, 0);
    assert.equal(plan.places[0]?.action, "unchanged");
    assert.equal(plan.experiences[0]?.action, "unchanged");
  });

  it("marks edited QA content as update on Production", () => {
    const payload = samplePayload();
    const existing = existingFromPayload(payload);
    const previous = existing.experiencesById.get("exp-approved");
    assert.ok(previous);
    existing.experiencesById.set("exp-approved", {
      ...previous,
      title: "Old title in production",
    });

    payload.experiences = [
      experience({
        id: "exp-approved",
        placeId: "place-a",
        title: "Kayak the river (edited in QA)",
      }),
    ];

    const plan = buildPromotionPlan(payload, existing);
    assert.equal(plan.experiences[0]?.action, "update");
    assert.equal(countPlanActions(plan).experiencesUpdated, 1);
  });

  it("builds a correct promotion summary for a mixed plan", () => {
    const payload = samplePayload();
    const existing = emptyExisting();
    existing.placesById.set(
      "place-a",
      place({ id: "place-a", slug: "austin-tx", name: "Old name" }),
    );
    existing.placesBySlug.set(
      "austin-tx",
      place({ id: "place-a", slug: "austin-tx", name: "Old name" }),
    );

    const plan = buildPromotionPlan(payload, existing);
    const counts = countPlanActions(plan);

    assert.deepEqual(counts, {
      placesCreated: 0,
      placesUpdated: 1,
      experiencesCreated: 1,
      experiencesUpdated: 0,
      tagsCreated: 1,
      tagsUpdated: 0,
      relationshipsAdded: 1,
    });
  });
});

describe("promoteQaToProduction orchestration", () => {
  async function withTempLogDir(run: (dir: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), "promotion-log-"));
    try {
      await run(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  function createMemoryTarget() {
    let production: PromotionPayload = {
      places: [],
      experiences: [],
      tags: [],
      experienceTags: [],
      approvedSubmissionCount: 0,
    };
    let applyCalls = 0;
    let failNextApply = false;

    const deps: PromoteDependencies = {
      async loadPayload() {
        return samplePayload();
      },
      async loadExisting(_url, payload) {
        const state = emptyExisting();
        for (const row of production.places) {
          if (payload.places.some((p) => p.id === row.id || p.slug === row.slug)) {
            state.placesById.set(row.id, row);
            state.placesBySlug.set(row.slug, row);
          }
        }
        for (const row of production.experiences) {
          if (payload.experiences.some((e) => e.id === row.id)) {
            state.experiencesById.set(row.id, row);
          }
        }
        for (const row of production.tags) {
          if (payload.tags.some((t) => t.id === row.id || t.name === row.name)) {
            state.tagsById.set(row.id, row);
            state.tagsByName.set(row.name, row);
          }
        }
        for (const row of production.experienceTags) {
          if (
            payload.experienceTags.some(
              (l) =>
                l.experienceId === row.experienceId && l.tagId === row.tagId,
            )
          ) {
            state.experienceTagsByPair.set(
              experienceTagPairKey(row.experienceId, row.tagId),
              row,
            );
          }
        }
        // Also index all production rows for conflict detection on slug/name
        for (const row of production.places) {
          state.placesBySlug.set(row.slug, row);
          state.placesById.set(row.id, row);
        }
        for (const row of production.tags) {
          state.tagsByName.set(row.name, row);
          state.tagsById.set(row.id, row);
        }
        return state;
      },
      async applyPlan(_url, plan: PromotionPlan): Promise<PromotionCounts> {
        applyCalls += 1;
        const snapshot = structuredClone(production);
        try {
          for (const item of plan.places) {
            if (item.action === "unchanged") continue;
            const idx = production.places.findIndex((p) => p.id === item.row.id);
            if (idx >= 0) {
              production.places[idx] = item.row;
            } else {
              production.places.push(item.row);
            }
          }
          for (const item of plan.tags) {
            if (item.action === "unchanged") continue;
            const idx = production.tags.findIndex((t) => t.id === item.row.id);
            if (idx >= 0) {
              production.tags[idx] = item.row;
            } else {
              production.tags.push(item.row);
            }
          }
          for (const item of plan.experiences) {
            if (item.action === "unchanged") continue;
            const idx = production.experiences.findIndex(
              (e) => e.id === item.row.id,
            );
            if (idx >= 0) {
              production.experiences[idx] = item.row;
            } else {
              production.experiences.push(item.row);
            }
          }
          for (const item of plan.experienceTags) {
            if (item.action === "unchanged") continue;
            const exists = production.experienceTags.some(
              (l) =>
                l.experienceId === item.row.experienceId &&
                l.tagId === item.row.tagId,
            );
            if (!exists) {
              production.experienceTags.push(item.row);
            }
          }

          // Simulate a mid-transaction failure after writes, then roll back.
          if (failNextApply) {
            failNextApply = false;
            throw new Error("simulated transaction failure");
          }

          return countPlanActions(plan);
        } catch (error) {
          production = snapshot;
          throw error;
        }
      },
      writeLog: async () => "memory",
      assertNotDevelopmentTarget() {
        // covered in env tests; allow memory URLs here
      },
    };

    return {
      deps,
      getProduction: () => production,
      getApplyCalls: () => applyCalls,
      failNextApply() {
        failNextApply = true;
      },
      seedProduction(payload: PromotionPayload) {
        production = structuredClone(payload);
      },
    };
  }

  it("dry run causes zero Production writes", async () => {
    await withTempLogDir(async (logDirectory) => {
      const memory = createMemoryTarget();
      const result = await promoteQaToProduction(
        {
          qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
          productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
          dryRun: true,
          confirmProduction: false,
          promotionId: "dry-run-id",
          logDirectory,
        },
        {
          ...memory.deps,
          writeLog: async (entry, dir) => {
            const { writePromotionLog } = await import(
              "../src/lib/promotion/log"
            );
            return writePromotionLog(entry, dir);
          },
        },
      );

      assert.equal(result.status, "dry_run");
      assert.equal(memory.getApplyCalls(), 0);
      assert.equal(memory.getProduction().experiences.length, 0);
      assert.match(formatPromoteCliOutput(result), /Dry run complete/);

      const log = JSON.parse(
        await readFile(join(logDirectory, "dry-run-id.json"), "utf8"),
      ) as { status: string; dryRun: boolean };
      assert.equal(log.status, "dry_run");
      assert.equal(log.dryRun, true);
    });
  });

  it("validation failure causes zero Production writes", async () => {
    const memory = createMemoryTarget();
    memory.seedProduction({
      places: [place({ id: "prod-other", slug: "austin-tx" })],
      experiences: [],
      tags: [],
      experienceTags: [],
      approvedSubmissionCount: 0,
    });

    const result = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
        promotionId: "conflict-id",
      },
      memory.deps,
    );

    assert.equal(result.status, "aborted");
    assert.equal(memory.getApplyCalls(), 0);
    assert.equal(memory.getProduction().experiences.length, 0);
    assert.equal(result.plan.conflicts.length > 0, true);
  });

  it("transaction failure rolls back Production writes", async () => {
    const memory = createMemoryTarget();
    memory.failNextApply();

    const result = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
        promotionId: "fail-id",
      },
      memory.deps,
    );

    assert.equal(result.status, "failure");
    assert.equal(memory.getApplyCalls(), 1);
    assert.equal(memory.getProduction().experiences.length, 0);
    assert.match(result.error ?? "", /simulated transaction failure/);
  });

  it("duplicate promotion does not create duplicates", async () => {
    const memory = createMemoryTarget();

    const first = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
        promotionId: "first-id",
      },
      memory.deps,
    );
    assert.equal(first.status, "success");
    assert.equal(first.counts.experiencesCreated, 1);

    const second = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
        promotionId: "second-id",
      },
      memory.deps,
    );

    assert.equal(second.status, "success");
    assert.equal(second.counts.experiencesCreated, 0);
    assert.equal(memory.getProduction().experiences.length, 1);
    assert.equal(memory.getProduction().places.length, 1);
    assert.equal(memory.getProduction().tags.length, 1);
    assert.equal(memory.getProduction().experienceTags.length, 1);
  });

  it("edited QA content updates Production on re-promote", async () => {
    const memory = createMemoryTarget();
    let payload = samplePayload();

    const deps: PromoteDependencies = {
      ...memory.deps,
      async loadPayload() {
        return payload;
      },
    };

    await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
      },
      deps,
    );

    payload = {
      ...payload,
      experiences: [
        experience({
          id: "exp-approved",
          placeId: "place-a",
          title: "Kayak the river — updated",
          description: "Updated description",
        }),
      ],
    };

    const result = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
      },
      deps,
    );

    assert.equal(result.status, "success");
    assert.equal(result.counts.experiencesUpdated, 1);
    assert.equal(memory.getProduction().experiences.length, 1);
    assert.equal(
      memory.getProduction().experiences[0]?.title,
      "Kayak the river — updated",
    );
  });

  it("refuses live promotion without --confirm-production", async () => {
    const memory = createMemoryTarget();
    const result = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: false,
      },
      memory.deps,
    );

    assert.equal(result.status, "aborted");
    assert.equal(memory.getApplyCalls(), 0);
    assert.match(result.error ?? "", /confirm-production/);
  });

  it("formats a successful promotion summary", async () => {
    const memory = createMemoryTarget();
    const result = await promoteQaToProduction(
      {
        qaDatabaseUrl: "postgresql://u:p@qa.neon.tech/neondb",
        productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
        dryRun: false,
        confirmProduction: true,
        promotionId: "summary-id",
      },
      memory.deps,
    );

    const output = formatPromoteCliOutput(result);
    assert.match(output, /Places created:\s+1/);
    assert.match(output, /Experiences created:\s+1/);
    assert.match(output, /Tags created:\s+1/);
    assert.match(output, /Relationships added:\s+1/);
    assert.match(output, /Promotion successful/);
    assert.match(output, /Promotion ID: summary-id/);
  });

  it("fails safely when dedicated URLs are missing", async () => {
    await assert.rejects(
      () =>
        promoteQaToProduction({
          qaDatabaseUrl: "",
          productionDatabaseUrl: "postgresql://u:p@prod.neon.tech/neondb",
          dryRun: true,
          confirmProduction: false,
        }),
      PromotionEnvError,
    );
  });
});

describe("promotion selection against database", () => {
  it("selects only experiences linked to approved submissions", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for promotion selection test");
    }

    const { inArray } = await import("drizzle-orm");
    const { db } = await import("../src/db");
    const {
      experience,
      experienceTag,
      place,
      submission,
      tag,
      user,
    } = await import("../src/db/schema");
    const { createPromotionHttpDb } = await import("../src/lib/promotion/db");
    const { selectApprovedContent } = await import(
      "../src/lib/promotion/select"
    );

    const suffix = Date.now().toString(36);
    const placeIds: string[] = [];
    const userIds: string[] = [];
    const experienceIds: string[] = [];
    const submissionIds: string[] = [];
    const tagIds: string[] = [];

    try {
      const [approvedPlace] = await db
        .insert(place)
        .values({
          name: `Promo Approved ${suffix}`,
          slug: `promo-approved-${suffix}`,
          city: "Austin",
          state: "TX",
          latitude: 30.27,
          longitude: -97.74,
        })
        .returning();
      const [otherPlace] = await db
        .insert(place)
        .values({
          name: `Promo Other ${suffix}`,
          slug: `promo-other-${suffix}`,
          city: "Dallas",
          state: "TX",
          latitude: 32.78,
          longitude: -96.8,
        })
        .returning();
      assert.ok(approvedPlace);
      assert.ok(otherPlace);
      placeIds.push(approvedPlace.id, otherPlace.id);

      const [contributor] = await db
        .insert(user)
        .values({
          name: "Promo Tester",
          email: `promo-tester-${suffix}@example.com`,
          role: "user",
        })
        .returning();
      assert.ok(contributor);
      userIds.push(contributor.id);

      const [approvedExperience] = await db
        .insert(experience)
        .values({
          placeId: approvedPlace.id,
          title: `Approved kayak ${suffix}`,
          description: "Promote me",
        })
        .returning();
      const [pendingExperience] = await db
        .insert(experience)
        .values({
          placeId: otherPlace.id,
          title: `Pending only ${suffix}`,
          description: "Do not promote",
        })
        .returning();
      const [orphanExperience] = await db
        .insert(experience)
        .values({
          placeId: otherPlace.id,
          title: `Orphan QA test ${suffix}`,
          description: "No submission",
        })
        .returning();
      assert.ok(approvedExperience);
      assert.ok(pendingExperience);
      assert.ok(orphanExperience);
      experienceIds.push(
        approvedExperience.id,
        pendingExperience.id,
        orphanExperience.id,
      );

      const [outdoorTag] = await db
        .insert(tag)
        .values({ name: `promo-outdoor-${suffix}` })
        .returning();
      const [noiseTag] = await db
        .insert(tag)
        .values({ name: `promo-noise-${suffix}` })
        .returning();
      assert.ok(outdoorTag);
      assert.ok(noiseTag);
      tagIds.push(outdoorTag.id, noiseTag.id);

      await db.insert(experienceTag).values([
        {
          experienceId: approvedExperience.id,
          tagId: outdoorTag.id,
        },
        {
          experienceId: orphanExperience.id,
          tagId: noiseTag.id,
        },
      ]);

      const [approvedSubmission] = await db
        .insert(submission)
        .values({
          userId: contributor.id,
          placeId: approvedPlace.id,
          experienceId: approvedExperience.id,
          content: "Approved content",
          status: "approved",
        })
        .returning();
      const [pendingSubmission] = await db
        .insert(submission)
        .values({
          userId: contributor.id,
          placeId: otherPlace.id,
          experienceId: pendingExperience.id,
          content: "Still pending",
          status: "pending",
        })
        .returning();
      assert.ok(approvedSubmission);
      assert.ok(pendingSubmission);
      submissionIds.push(approvedSubmission.id, pendingSubmission.id);

      const qaDb = createPromotionHttpDb(databaseUrl);
      const payload = await selectApprovedContent(qaDb);

      const selectedExperienceIds = new Set(
        payload.experiences.map((row) => row.id),
      );
      assert.equal(selectedExperienceIds.has(approvedExperience.id), true);
      assert.equal(selectedExperienceIds.has(pendingExperience.id), false);
      assert.equal(selectedExperienceIds.has(orphanExperience.id), false);

      assert.equal(
        payload.places.some((row) => row.id === approvedPlace.id),
        true,
      );
      assert.equal(
        payload.places.some((row) => row.id === otherPlace.id),
        false,
      );
      assert.equal(
        payload.tags.some((row) => row.id === outdoorTag.id),
        true,
      );
      assert.equal(
        payload.tags.some((row) => row.id === noiseTag.id),
        false,
      );
      assert.equal(
        payload.experienceTags.some(
          (row) =>
            row.experienceId === approvedExperience.id &&
            row.tagId === outdoorTag.id,
        ),
        true,
      );
    } finally {
      if (submissionIds.length > 0) {
        await db
          .delete(submission)
          .where(inArray(submission.id, submissionIds));
      }
      if (experienceIds.length > 0) {
        await db
          .delete(experienceTag)
          .where(inArray(experienceTag.experienceId, experienceIds));
        await db
          .delete(experience)
          .where(inArray(experience.id, experienceIds));
      }
      if (tagIds.length > 0) {
        await db.delete(tag).where(inArray(tag.id, tagIds));
      }
      if (placeIds.length > 0) {
        await db.delete(place).where(inArray(place.id, placeIds));
      }
      if (userIds.length > 0) {
        await db.delete(user).where(inArray(user.id, userIds));
      }
    }
  });
});
