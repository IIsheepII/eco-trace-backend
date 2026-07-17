export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  MAX_FILE_SIZE_MB: number;
  OCR_LANGUAGE: string;
  OCR_ENGINE: string;
  OCR_FALLBACK_ENGINE: string;
  OCR_MAX_FILE_SIZE_MB: number;
  OCR_TEMP_DIR: string;
  OCR_CLEAN_TEMP_FILES: boolean;
  OCR_TESSERACT_PSM: number;
  OCR_TESSERACT_EXTRA_PSMS: string;
  OCR_TESSERACT_OEM: number;
  TESSERACT_PATH: string;
  POPPLER_PATH: string;
  PDF_CONVERSION_DPI: number;
  PDF_CONVERSION_FORMAT: string;
  PDF_MAX_PAGES: number;
  GOOGLE_CLOUD_PROJECT: string;
  GOOGLE_CLOUD_VISION_BUCKET: string;
  GOOGLE_CLOUD_VISION_TIMEOUT_MS: number;
}

export function envValidation(config: Record<string, unknown>): EnvironmentVariables {
  const required = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable ${key}`);
    }
  }

  const ocrEngine = String(config.OCR_ENGINE ?? 'tesseract').toLowerCase();
  const ocrFallbackEngine = String(config.OCR_FALLBACK_ENGINE ?? 'tesseract').toLowerCase();
  const supportedOcrEngines = new Set(['tesseract', 'google-vision', 'none']);
  if (!supportedOcrEngines.has(ocrEngine) || !supportedOcrEngines.has(ocrFallbackEngine)) {
    throw new Error('OCR_ENGINE and OCR_FALLBACK_ENGINE must be tesseract, google-vision or none');
  }
  if (ocrEngine === 'google-vision' && !config.GOOGLE_CLOUD_PROJECT) {
    throw new Error('Missing required environment variable GOOGLE_CLOUD_PROJECT for Google Vision OCR');
  }

  return {
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    PORT: Number(config.PORT ?? 3000),
    DATABASE_URL: String(config.DATABASE_URL),
    ACCESS_TOKEN_SECRET: String(config.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_SECRET: String(config.REFRESH_TOKEN_SECRET),
    ACCESS_TOKEN_TTL: String(config.ACCESS_TOKEN_TTL ?? '15m'),
    REFRESH_TOKEN_TTL: String(config.REFRESH_TOKEN_TTL ?? '7d'),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? 'http://localhost:5174'),
    UPLOAD_DIR: String(config.UPLOAD_DIR ?? './uploads'),
    MAX_FILE_SIZE_MB: Number(config.MAX_FILE_SIZE_MB ?? 20),
    OCR_LANGUAGE: String(config.OCR_LANGUAGE ?? 'spa+eng'),
    OCR_ENGINE: ocrEngine,
    OCR_FALLBACK_ENGINE: ocrFallbackEngine,
    OCR_MAX_FILE_SIZE_MB: Number(config.OCR_MAX_FILE_SIZE_MB ?? 10),
    OCR_TEMP_DIR: String(config.OCR_TEMP_DIR ?? './tmp/ocr'),
    OCR_CLEAN_TEMP_FILES: String(config.OCR_CLEAN_TEMP_FILES ?? 'true') === 'true',
    OCR_TESSERACT_PSM: Number(config.OCR_TESSERACT_PSM ?? 6),
    OCR_TESSERACT_EXTRA_PSMS: String(config.OCR_TESSERACT_EXTRA_PSMS ?? '11'),
    OCR_TESSERACT_OEM: Number(config.OCR_TESSERACT_OEM ?? 1),
    TESSERACT_PATH: String(config.TESSERACT_PATH ?? ''),
    POPPLER_PATH: String(config.POPPLER_PATH ?? ''),
    PDF_CONVERSION_DPI: Number(config.PDF_CONVERSION_DPI ?? 300),
    PDF_CONVERSION_FORMAT: String(config.PDF_CONVERSION_FORMAT ?? 'png'),
    PDF_MAX_PAGES: Number(config.PDF_MAX_PAGES ?? 20),
    GOOGLE_CLOUD_PROJECT: String(config.GOOGLE_CLOUD_PROJECT ?? ''),
    GOOGLE_CLOUD_VISION_BUCKET: String(config.GOOGLE_CLOUD_VISION_BUCKET ?? ''),
    GOOGLE_CLOUD_VISION_TIMEOUT_MS: Number(config.GOOGLE_CLOUD_VISION_TIMEOUT_MS ?? 30_000),
  };
}
