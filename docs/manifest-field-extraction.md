# Manifest Field Extraction

## Flow

1. The uploaded PDF is converted to page images with Poppler.
2. Tesseract OCR runs per page and stores the raw text in `OcrResult`.
3. `AiExtractionService` reads the latest completed OCR result.
4. The service extracts only fields configured in `DocumentFieldDefinition`.
5. Extracted values are stored as `ExtractedField` suggestions.
6. Human validation remains mandatory before data is considered final.

## Supported Manifest Fields

- `manifest_year`
- `manifest_month`
- `generator_razon_social`
- `generator_ruc`
- `plant_denominacion`
- `waste_total_kg`
- `basel_a4`
- `transporter_razon_social`
- `transporter_ruc`
- `transporter_registro_eo_rs`
- `transporter_responsable_tecnico`
- `transporter_colegiatura`
- `driver_name`
- `vehicle_plate`
- `waste_reception_date`
- `received_quantity_t`
- `destination_razon_social_siglas`
- `destination_ruc`
- `destination_codigo_registro_eo_rs`
- `destination_address`
- `destination_responsable_tecnico`
- `destination_responsable_name`
- `destination_responsable_dni_ce`
- `destination_fecha_hora`

## Strategy

The extractor uses deterministic rules first. Text is normalized to reduce OCR noise from accents, `N°`, mixed case, broken punctuation, and table spacing. Fields are extracted by section when possible:

- Header: year and month.
- Generator: legal name and RUC.
- Plant: plant denomination.
- Residue: total quantity and `A-4` code value.
- Transport: EO-RS transport company, RUC, registry, technical responsible, license, driver and vehicle.
- Destination: destination company, RUC, registry, address, responsible person, DNI/CE and timestamp.

## Traceability

Each extracted field stores:

- `aiValue`: suggested value or `null`.
- `confidence`: high enough for suggestions, low when missing.
- `rawPayload.method`: currently `regex` or `ocr-unavailable`.
- `rawPayload.evidenceText`: nearby OCR text when a value is found.
- `rawPayload.needsReview`: always `true`, because human validation is required.

## Limitations

Handwritten names, stamps and signatures remain low reliability with Tesseract. These values must be reviewed by a human. If OCR misses a field completely, the extractor returns `null` rather than inventing a value.

## Adding Fields

1. Add the field to `prisma/seed.ts` under the MANIFEST document type.
2. Add a section-aware extraction rule in `AiExtractionService`.
3. Add or update OCR fixture text in `ai-extraction.service.spec.ts`.
4. Run `pnpm prisma:seed`, `pnpm build`, and `pnpm test`.
