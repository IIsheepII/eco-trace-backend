# Eco Trace Backend

Intelligent document management backend built as a NestJS modular monolith using Clean Architecture and DDD-lite boundaries. It supports HttpOnly authentication, organisation isolation, document upload, OCR, AI/rule extraction, human validation, reporting, metrics and audit logs.

## Stack

- NestJS + TypeScript
- PostgreSQL + Prisma ORM
- PNPM
- Swagger at `/docs`
- Jest + Supertest
- REST API with HttpOnly cookie authentication

## Folder Structure

```text
src/
  common/              decorators, filters, guards, interceptors, shared request types
  config/              environment validation
  database/            Prisma service/module
  modules/
    auth/              login, refresh rotation, logout, cookies
    users/             organisation-scoped user management
    roles/             role and permission management
    organisations/     organisation administration
    documents/         upload, metadata, search, document aggregate reads
    document-types/    document type catalog
    document-fields/   expected field definitions
    file-storage/      file validation and local storage adapter
    ocr/               OCR processing job boundary
    ai-extraction/     AI/rule extraction boundary
    validation/        human validation and final field values
    reports/           PDF/XLSX report records
    metrics/           registration/search/error/accuracy/report timings
    audit/             audit log queries
    settings/          organisation settings
prisma/
  schema.prisma
  seed.ts
test/
  jest-e2e.json
```

## REST Endpoints

All endpoints are prefixed by `/api/v1`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Login and set `access_token` + `refresh_token` HttpOnly cookies |
| POST | `/auth/refresh` | Rotate refresh token and issue a new token pair |
| POST | `/auth/logout` | Revoke refresh token and clear cookies |
| GET | `/users` | List users in current organisation |
| POST | `/users` | Create user |
| PATCH | `/users/:id` | Update user |
| GET | `/roles` | List global and organisation roles |
| POST | `/roles` | Create organisation role |
| GET | `/organisations` | List organisations |
| POST | `/organisations` | Create organisation |
| GET | `/document-types` | List document types and fields |
| GET | `/document-types/:id` | Read document type |
| POST | `/document-types` | Create document type |
| POST | `/document-fields` | Create expected field definition |
| POST | `/documents/upload` | Upload PDF/image and create document |
| GET | `/documents` | Search by title, type, metadata/extracted fields |
| GET | `/documents/:id` | Read document aggregate |
| POST | `/ocr/documents/:documentId/run` | Run OCR job |
| POST | `/ai-extraction/documents/:documentId/run` | Run extraction job |
| POST | `/validation/documents/:documentId` | Human-validate extracted values |
| GET | `/reports` | List reports |
| POST | `/reports` | Generate PDF/XLSX report record |
| GET | `/metrics` | Query metrics |
| GET | `/audit` | Query audit logs |
| GET | `/settings` | List settings |
| PUT | `/settings` | Upsert setting |

## Local Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

Seeded admin:

```text
email: admin@eco-trace.local
password: Admin123!
```

## Design Notes

- Access tokens are accepted from the `access_token` HttpOnly cookie or a Bearer header.
- Refresh tokens are stored hashed, rotated on each refresh, and revoked on logout.
- Every document query is organisation-scoped to prevent cross-organisation access.
- AI extracted fields and human validated fields are separate tables. Final values are only written through the validation endpoint.
- Uploaded original files are not exposed through delete endpoints, preventing accidental removal while validation records depend on them.
- File uploads validate MIME type and size before persistence.
- Consistent error responses are emitted by a global exception filter.
- Swagger uses cookie auth and is available at `/docs`.

## Metrics

The platform records:

- `registration_time`
- `search_time`
- `transcription_errors`
- `extraction_accuracy`
- `report_generation_time`

## Testing

```bash
pnpm test
pnpm test:e2e
pnpm test:cov
```

Coverage thresholds are configured at 80% globally and 90% for critical auth and validation modules.
