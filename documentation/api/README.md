# API documentation

This folder documents the project's HTTP API contract.

## Contents

| File | Purpose |
| --- | --- |
| [openapi.yaml](./openapi.yaml) | OpenAPI 3 specification for the HTTP API |
| [redocly.yaml](./redocly.yaml) | Lightweight lint config for validating the specification |

`openapi.yaml` is the source of truth for request and response shapes, status codes, validation rules, and error formats that callers can rely on.

Currently documented areas:

- Places (`/api/places`)
- Experiences and experience tag assignments (`/api/experiences`)

## How to use the specification

- Read `openapi.yaml` when implementing clients, writing tests, or reviewing API changes.
- Import the file into any OpenAPI-compatible viewer or client generator when needed (Swagger UI, Redoc, Postman, Insomnia, etc.).
- Treat documented status codes and schemas as the contract: if behavior changes in code, update this file in the same task.

This repository does not currently ship an in-app Swagger/OpenAPI viewer. Prefer the YAML file directly rather than adding a large viewer dependency unless one is intentionally introduced later.

## Keeping documentation synchronized

API documentation must remain synchronized with the implementation and API tests.

Whenever an endpoint is created, modified, renamed, or removed:

1. Update `openapi.yaml` in the same development task.
2. Update related API tests when the contract changes.
3. Confirm documented schemas, validation rules, and status codes still match the code.

Do not document behavior the API does not implement.
