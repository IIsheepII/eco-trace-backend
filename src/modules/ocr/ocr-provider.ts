export type OcrEngine = 'tesseract' | 'google-vision' | 'none';

export type OcrProviderInput = {
  filePath: string;
  language: string;
  engine?: Exclude<OcrEngine, 'none'>;
  psm?: number;
  profile?: string;
};

export type OcrDocumentInput = {
  filePath: string;
  mimeType: 'application/pdf';
  language: string;
};

export type OcrProviderResult = {
  rawText: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export interface OcrProvider {
  extractText(input: OcrProviderInput): Promise<OcrProviderResult>;
  extractDocument?(input: OcrDocumentInput): Promise<OcrProviderResult>;
}

export const OCR_PROVIDER = Symbol('OCR_PROVIDER');
