# OCR Integration

This backend uses a local Tesseract CLI provider for OCR. It is intended for local, zero-cost testing and keeps the original document upload flow intact.

## Dependencies

Install Tesseract OCR on the host machine and make sure it is available in `PATH`.

Windows recommended installer:

- UB Mannheim Tesseract OCR build
- Install language data for `eng`, `spa`, and `osd`

Verify:

```bash
tesseract --version
tesseract --list-langs
```

Expected languages for this project:

```text
eng
osd
spa
```

No npm OCR runtime dependency is required for the current implementation because NestJS calls the local `tesseract` binary through a provider.

## Environment

```env
OCR_LANGUAGE=spa+eng
OCR_ENGINE=tesseract
OCR_MAX_FILE_SIZE_MB=10
OCR_TEMP_DIR=./tmp/ocr
```

`OCR_TEMP_DIR` is reserved for future PDF conversion or image preprocessing.

## Endpoints

Existing compatibility endpoint:

```http
POST /api/v1/ocr/documents/:documentId/run
```

Document-scoped endpoints:

```http
POST /api/v1/documents/:id/ocr/process
GET  /api/v1/documents/:id/ocr-result
GET  /api/v1/documents/:id/processing-status
```

All endpoints require the existing HttpOnly cookie auth. OCR processing requires `documents:manage`.

## Supported Files

Currently supported for real OCR:

- PNG
- JPG / JPEG
- TIFF
- WEBP
- PDF, through Poppler conversion to page images

PDF pages are converted to images with Poppler `pdftoppm`, then each generated image is processed by Tesseract.

## Processing Flow

1. User uploads a document.
2. Backend stores the original file.
3. Backend creates an OCR processing job.
4. OCR validates document ownership and physical file availability.
5. Tesseract extracts raw text.
6. Backend stores `OcrResult`.
7. Backend updates `ProcessingJob`.
8. Backend updates document status to `OCR_COMPLETED` or `OCR_FAILED`.
9. AI extraction can use latest completed OCR text for rule-based extraction.

OCR text is not treated as validated user data. Human validation still writes final values through the validation module.

## Testing

```bash
pnpm prisma:generate
pnpm test
pnpm build
```

Run one OCR test manually:

```bash
tesseract ./sample.png stdout -l spa+eng
```

Then upload the same image through the app and call:

```http
POST /api/v1/documents/:id/ocr/process
GET  /api/v1/documents/:id/ocr-result
```

## Troubleshooting

If OCR fails with an installation error:

- Open a new terminal after installing Tesseract.
- Check `tesseract --version`.
- Check `tesseract --list-langs`.
- Confirm `spa.traineddata` exists in `C:\Program Files\Tesseract-OCR\tessdata`.

If OCR fails for PDFs:

- Check `pdftoppm -v`.
- Check `pdfinfo -v`.
- Set `POPPLER_PATH` to the folder containing `pdftoppm.exe` and `pdfinfo.exe` on Windows.
- Lower `PDF_CONVERSION_DPI` for very large PDFs.
- Increase `PDF_MAX_PAGES` only if the backend can tolerate longer processing time.

If OCR returns poor text:

- Prefer 300 DPI scans.
- Avoid skewed/rotated images.
- Use `spa+eng` only when both languages are needed; narrower language sets can improve accuracy.
