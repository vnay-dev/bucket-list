# Documentation

This folder is the project's technical source of truth.

It holds documentation that future developers can use to understand how the system is designed and how it should behave, without relying on external notes or Notion.

## Current coverage

- **Database** — finalized V1 data model (tables, relationships, constraints, indexes, workflows).
- **API** — HTTP API contract documented as OpenAPI for implemented endpoints.

## Keeping docs current

Update these files whenever the underlying implementation changes. Documentation and code should stay aligned. For API changes, also follow `.cursor/rules/api-documentation.mdc`.

## Contents

- [Database](./database/README.md) — V1 PostgreSQL data model (Neon + Drizzle)
- [API](./api/README.md) — HTTP API OpenAPI specification
