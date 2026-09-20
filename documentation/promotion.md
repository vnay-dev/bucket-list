# QA → Production content promotion

## Why this exists

Curators may refine real content in the **QA** Neon environment before launch. A Submission with status `approved` (and a linked `experience_id`) marks that curated Experience as production-ready.

This workflow copies that curated catalog from QA into **Production** in a controlled, repeatable, idempotent way. It does **not** change the in-app curation / submission approval flow.

## What gets promoted

| Entity | Included | Notes |
| --- | --- | --- |
| Place | Yes | Places referenced by approved Experiences |
| Experience | Yes | Experiences linked from approved Submissions |
| Tag | Yes | Tags linked to those Experiences |
| ExperienceTag | Yes | Relationships for those Experiences |
| User | **No** | Production has its own accounts |
| Wishlist | **No** | User-local data |
| Submission | **No** | Curation audit stays in QA |

Selection rule: `Submission.status = 'approved'` **and** `experience_id IS NOT NULL`. Only those Experiences (and their Places / Tags / ExperienceTags) are promoted. Unrelated QA/test rows are ignored.

## Required environment variables

Set these in `.env.local` (see `.env.example`). The promotion CLI **never** uses `DATABASE_URL` as source or target.

| Variable | Role |
| --- | --- |
| `QA_DATABASE_URL` | Source database (QA) |
| `PRODUCTION_DATABASE_URL` | Target database (Production) |
| `DATABASE_URL` / `DEVELOPMENT_DATABASE_URL` | Used only as a safety check so Production cannot equal development |

Credentials are never hard-coded.

## Dry run

```bash
npm run promote:qa -- --dry-run
```

- Connects to QA and reads Production for conflict detection
- Validates relationships and unique-key conflicts
- Prints a ready summary
- Writes a local log under `promotion-logs/`
- Makes **zero** changes to Production

## Real promotion

1. Create a Neon restore point (branch or note a PITR timestamp) — see below
2. Run a dry run and review the plan
3. Promote:

```bash
npm run promote:qa -- --confirm-production
```

`--confirm-production` is required for a live run. Without it, the command aborts after validation.

## Idempotency

Primary keys from QA are preserved in Production so relationships stay intact:

- `Experience.place_id` → same Place id
- `ExperienceTag.experience_id` / `tag_id` → same Experience / Tag ids

Upserts use those ids. Re-running the command does not duplicate rows. If QA content changed, the next run updates the matching Production rows. ExperienceTag links are additive (existing Production-only tag links on an experience are not removed).

## Validation and transactions

Before writing Production:

1. Resolve the approved content set from QA
2. Validate required Place / Tag relationships
3. Detect slug/name id mismatches against Production
4. Abort with a conflict report if validation fails (**no Production writes**)

Live writes run inside a single database transaction. On failure, the transaction rolls back so Production is not left partially promoted.

## Promotion log

Each run writes `promotion-logs/<promotion-id>.json` (gitignored) with:

- promotion ID, timestamp
- source / target environments (`qa` → `production`)
- create/update counts for Places, Experiences, Tags
- ExperienceTag relationships added
- status (`success` | `failure` | `dry_run` | `aborted`)
- error message when failed / aborted

No database schema change is required for logging.

## Rollback procedure (Neon)

Before a live promotion:

1. Open the Production project in the [Neon console](https://console.neon.tech)
2. Create a temporary **branch** from current Production, **or** note the current time for **Point-in-Time Restore** (if available on your plan)
3. Keep that branch / timestamp until Production is verified

If promotion causes a serious problem:

1. Restore Production from that branch or PITR timestamp in the Neon console
2. Re-run `npm run promote:qa -- --dry-run` to inspect state
3. Fix conflicts in QA or Production, then promote again

This project does not ship a custom backup store; Neon is the restore mechanism.

## Safety guards

- Dedicated `QA_DATABASE_URL` and `PRODUCTION_DATABASE_URL` only
- Source and target must differ
- Production URL must not match development (`DATABASE_URL` / `DEVELOPMENT_DATABASE_URL`)
- Production URL must not look like a development database (host / db name / branch heuristics)
- Live runs require `--confirm-production`
- Dry run and live confirm flags are mutually exclusive

## Limitations / assumptions

- QA and Production are separate Neon databases/environments
- Approved submissions in QA always point at the Experiences that should go live
- Place `slug` and Tag `name` uniqueness must not conflict across environments with different ids (validation aborts if they do)
- Users, wishlists, and submissions are intentionally not copied
- ExperienceTag promotion is additive only
- Local JSON logs are machine-local; copy them elsewhere if you need shared audit history
- Large promotions run in one transaction; extremely large catalogs may need operational batching later

## Implementation map

| Path | Role |
| --- | --- |
| `scripts/promote-qa.ts` | CLI entrypoint |
| `src/lib/promotion/` | Selection, validation, plan, apply, logging |
| `npm run promote:qa` | Package script |
