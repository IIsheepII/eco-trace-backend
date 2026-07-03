export type OcrProviderInput = {
  filePath: string;
  language: string;
};

export type OcrProviderResult = {
  rawText: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export interface OcrProvider {
  extractText(input: OcrProviderInput): Promise<OcrProviderResult>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
