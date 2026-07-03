# PDF Poppler Integration

Poppler is used to convert PDF pages into images before Tesseract OCR runs. Tesseract reads images well, while PDFs need a rendering step first.

## Technical Decision

This project uses the Poppler CLI directly:

- `pdfinfo` reads PDF metadata and page count.
- `pdftoppm` renders each page into PNG or JPEG.

This is preferred over `pdf-poppler` or `pdf2pic` for local thesis/demo usage because it is stable, explicit, easy to debug from the terminal, and avoids wrapper-specific native dependency issues.

## Environment Variables

```env
POPPLER_PATH=
PDF_CONVERSION_DPI=200
PDF_CONVERSION_FORMAT=png
OCR_TEMP_DIR=./tmp/ocr
OCR_CLEAN_TEMP_FILES=true
PDF_MAX_PAGES=20
```

On Windows, `POPPLER_PATH` should point to the folder that contains `pdftoppm.exe` and `pdfinfo.exe`.

Example:

```env
POPPLER_PATH=C:\Program Files\poppler\Library\bin
```

If Poppler is already in `PATH`, leave `POPPLER_PATH` empty.

## Installation

### Windows

Use a precompiled Windows build. Do not use the source tarball from the official Poppler page unless you intend to compile it.

Recommended release source:

```text
https://github.com/oschwartz10612/poppler-windows/releases
```

Download a release ZIP, extract it, and add the `Library\bin` folder to PATH or set `POPPLER_PATH`.

Validate:

```powershell
pdftoppm -v
pdfinfo -v
```

### Linux

```bash
sudo apt update
sudo apt install poppler-utils
pdftoppm -v
pdfinfo -v
```

### macOS

```bash
brew install poppler
pdftoppm -v
pdfinfo -v
```

## Manual Test

Convert a PDF to PNG files:

```bash
pdftoppm -png -r 200 sample.pdf page
```

Expected output:

```text
page-1.png
page-2.png
```

Then OCR one page:

```bash
tesseract page-1.png stdout -l spa+eng
```

## Backend Flow

1. User uploads a PDF.
2. `OcrService` detects `application/pdf`.
3. `PdfProcessingService` creates a unique temporary directory.
4. `pdfinfo` validates page count.
5. `pdftoppm` converts pages to images.
6. Tesseract runs once per generated page.
7. OCR text is concatenated with page markers.
8. `OcrResult.metadata` stores conversion and OCR timing details.
9. Temporary files are removed when `OCR_CLEAN_TEMP_FILES=true`.

## Error Handling

Common failures:

- Poppler is not installed.
- `POPPLER_PATH` points to the wrong folder.
- PDF is corrupt or password protected.
- PDF has more pages than `PDF_MAX_PAGES`.
- Conversion creates no images.
- Temporary directory cannot be created or cleaned.

Errors are returned through the existing API error shape and internal file paths are not intentionally exposed to the frontend.

## Limitations

- OCR is synchronous in the current HTTP request.
- Very large PDFs can take time; keep `PDF_MAX_PAGES` conservative.
- Accuracy depends on PDF scan quality and DPI.
- Future production hardening should move OCR to a background queue.
