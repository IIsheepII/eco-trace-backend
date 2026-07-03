# Eco Trace API Contract

Base URL local: `http://localhost:3000/api/v1`

Auth model: HttpOnly cookies. `POST /auth/login` and `POST /auth/refresh` set `access_token` and `refresh_token`. Protected endpoints read `access_token` from cookies, with Bearer token fallback.

## Endpoints

| Method | Endpoint | Request | Response | Permission |
|---|---|---|---|---|
| POST | `/auth/login` | `LoginDto` | `{ user }` + auth cookies | Public |
| POST | `/auth/refresh` | refresh cookie | `{ user }` + rotated auth cookies | Public |
| POST | `/auth/logout` | auth cookies | `204` | Authenticated |
| POST | `/documents/upload` | multipart `CreateDocumentDto` + `file` | `Document` with `uploadedFile` | `documents:manage` |
| GET | `/documents` | `SearchDocumentsDto` query | `Document[]` | Authenticated |
| GET | `/documents/:id` | path `id` | `Document` detail | Authenticated |
| GET | `/documents/:id/file` | path `id` | original file stream | Authenticated |
| POST | `/documents/:id/ocr/process` | path `id` | `{ job, ocrResult }` | `documents:manage` |
| GET | `/documents/:id/ocr-result` | path `id` | latest `OcrResult` | Authenticated |
| GET | `/documents/:id/processing-status` | path `id` | `ProcessingStatusResponse` | Authenticated |
| POST | `/ai-extraction/documents/:documentId/run` | path `documentId` | `{ job, extracted }` | `documents:manage` |
| POST | `/validation/documents/:documentId` | `FieldValidationDto` | validation result | `documents:validate` |
| GET | `/document-types` | none | `DocumentType[]` | Authenticated |
| GET | `/document-types/:id` | path `id` | `DocumentType` | Authenticated |
| POST | `/document-types` | create DTO | `DocumentType` | `documents:manage` |
| POST | `/document-fields` | create DTO | `DocumentFieldDefinition` | `documents:manage` |
| GET | `/metrics` | none | `Metric[]` | `reports:read` |
| GET | `/reports` | none | `Report[]` | `reports:read` |
| POST | `/reports` | `ReportRequestDto` | `Report` | `reports:read` |
| GET | `/settings` | none | `Setting[]` | `settings:manage` |
| PUT | `/settings` | settings payload | updated settings | `settings:manage` |
| GET | `/audit` | query filters | `AuditLog[]` | `settings:manage` |
| GET | `/users` | none | `User[]` | `users:manage` |
| POST | `/users` | create DTO | `User` | `users:manage` |
| PATCH | `/users/:id` | update DTO | `User` | `users:manage` |
| GET | `/roles` | none | `Role[]` | `roles:manage` |
| POST | `/roles` | create DTO | `Role` | `roles:manage` |
| GET | `/organisations` | none | `Organisation[]` | `organisations:manage` |
| POST | `/organisations` | create DTO | `Organisation` | `organisations:manage` |

Legacy compatibility:

| Method | Endpoint | Status |
|---|---|---|
| POST | `/ocr/documents/:documentId/run` | Legacy OCR route. Prefer `/documents/:id/ocr/process`. |

## DTOs

### LoginDto

| Field | Type | Required |
|---|---|---|
| `email` | string | yes |
| `password` | string | yes |

### CreateDocumentDto

Multipart form payload.

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Document title. |
| `documentTypeId` | string | yes | Existing active document type. |
| `metadata` | JSON string/object | no | Optional metadata. |
| `file` | binary | yes | PDF, PNG, JPG, TIFF or WEBP. |

### SearchDocumentsDto

| Field | Type | Required |
|---|---|---|
| `q` | string | no |
| `documentTypeId` | string | no |
| `fieldName` | string | no |
| `fieldValue` | string | no |

### OcrProcessResponse

| Field | Type |
|---|---|
| `job` | `ProcessingJob` |
| `ocrResult` | `OcrResult` |

### ProcessingStatusResponse

| Field | Type | Notes |
|---|---|---|
| `documentId` | string | Current document id. |
| `documentStatus` | `DocumentStatus` | Backend document status. |
| `latestJob` | `ProcessingJob \| null` | Latest processing job of any type. |
| `ocrJob` | `ProcessingJob \| null` | Latest OCR job. |
| `aiExtractionJob` | `ProcessingJob \| null` | Latest AI extraction job. |
| `ocrResult` | OCR result summary or `null` | Latest OCR result summary. |

### FieldValidationDto

| Field | Type | Required |
|---|---|---|
| `fields` | array | yes |
| `fields[].fieldDefinitionId` | string | yes |
| `fields[].extractedFieldId` | string | no |
| `fields[].finalValue` | string | yes |
| `notes` | string | no |

### ReportRequestDto

| Field | Type | Required |
|---|---|---|
| `title` | string | yes |
| `format` | `PDF` or `XLSX` | yes |
| `documentId` | string | no |
| `criteria` | object | no |

## Status Lifecycle

| Flow | Status |
|---|---|
| Upload completed | `OCR_PENDING` |
| OCR job queued | `ProcessingJob.status = QUEUED` |
| OCR running | `ProcessingJob.status = RUNNING`, `Document.status = OCR_PENDING` |
| OCR success | `ProcessingJob.status = COMPLETED`, `Document.status = OCR_COMPLETED` |
| OCR failure | `ProcessingJob.status = FAILED`, `Document.status = OCR_FAILED` |
| AI extraction success | `ProcessingJob.status = COMPLETED`, `Document.status = VALIDATION_PENDING` |
| Human validation success | `Document.status = VALIDATED` |

## Role/Permission Matrix

| Role | Expected Permissions |
|---|---|
| `admin` | `users:manage`, `roles:manage`, `organisations:manage`, `documents:manage`, `documents:validate`, `reports:read`, `settings:manage` |
| `validator` | `documents:validate`, document read access |
| `auditor` | `reports:read`, audit/report read access |
| `viewer` | document read access |

The seed currently creates `admin@eco-trace.local` with the full admin permission set.
