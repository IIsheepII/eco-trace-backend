import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { readFile } from 'node:fs/promises';
import { OcrDocumentInput, OcrProvider, OcrProviderInput, OcrProviderResult } from './ocr-provider';

type VisionPage = {
  blocks?: Array<{ confidence?: number | null }> | null;
  property?: { detectedLanguages?: Array<{ languageCode?: string | null; confidence?: number | null }> | null } | null;
};

type VisionAnnotationResponse = {
  error?: { message?: string | null } | null;
  fullTextAnnotation?: { text?: string | null; pages?: VisionPage[] | null } | null;
};

type VisionFileBatchResponse = {
  responses?: Array<{
    error?: { message?: string | null } | null;
    responses?: VisionAnnotationResponse[] | null;
  }> | null;
};

@Injectable()
export class GoogleVisionProvider implements OcrProvider {
  private client?: ImageAnnotatorClient;

  constructor(private readonly config: ConfigService) {}

  async extractText(input: OcrProviderInput): Promise<OcrProviderResult> {
    try {
      const [batchResponse] = await this.getClient().batchAnnotateImages(
        {
          requests: [
            {
              image: { content: await readFile(input.filePath) },
              features: [{ type: protos.google.cloud.vision.v1.Feature.Type.DOCUMENT_TEXT_DETECTION }],
              imageContext: { languageHints: this.languageHints(input.language) },
            },
          ],
        },
        { timeout: this.config.get<number>('GOOGLE_CLOUD_VISION_TIMEOUT_MS', 30_000) },
      );
      const response = batchResponse.responses?.[0];
      if (response?.error?.message) throw new Error(response.error.message);
      const annotation = response?.fullTextAnnotation;
      return {
        rawText: annotation?.text?.trim() ?? '',
        confidence: this.averageConfidence(annotation?.pages ?? []),
        metadata: {
          engine: 'google-cloud-vision',
          model: 'DOCUMENT_TEXT_DETECTION',
          pageCount: annotation?.pages?.length ?? 0,
          detectedLanguages: this.detectedLanguages(annotation?.pages ?? []),
          profile: input.profile,
        },
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Google Vision error';
      throw new ServiceUnavailableException(`Google Vision OCR failed: ${detail}`);
    }
  }

  async extractDocument(input: OcrDocumentInput): Promise<OcrProviderResult> {
    try {
      const request: protos.google.cloud.vision.v1.IBatchAnnotateFilesRequest = {
        requests: [
          {
            inputConfig: {
              mimeType: input.mimeType,
              content: await readFile(input.filePath),
            },
            features: [{ type: protos.google.cloud.vision.v1.Feature.Type.DOCUMENT_TEXT_DETECTION }],
            imageContext: { languageHints: this.languageHints(input.language) },
          },
        ],
      };
      const [rawBatchResponse] = await this.getClient().batchAnnotateFiles(
        request,
        { timeout: this.config.get<number>('GOOGLE_CLOUD_VISION_TIMEOUT_MS', 30_000) },
      );
      const batchResponse = rawBatchResponse as unknown as VisionFileBatchResponse;
      const fileResponse = batchResponse.responses?.[0];
      if (fileResponse?.error?.message) throw new Error(fileResponse.error.message);

      const responses = fileResponse?.responses ?? [];
      const pages = responses.map((response, index) => {
        if (response.error?.message) throw new Error(response.error.message);
        const annotation = response.fullTextAnnotation;
        return {
          page: index + 1,
          text: annotation?.text?.trim() ?? '',
          confidence: this.averageConfidence(annotation?.pages ?? []),
          metadata: {
            engine: 'google-cloud-vision',
            model: 'DOCUMENT_TEXT_DETECTION',
            detectedLanguages: this.detectedLanguages(annotation?.pages ?? []),
          },
        };
      });
      const confidenceValues = pages.map((page) => page.confidence).filter((value): value is number => value !== undefined);

      return {
        rawText: pages.map((page) => `--- Page ${page.page} ---\n${page.text}`).join('\n\n').trim(),
        confidence: confidenceValues.length
          ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
          : undefined,
        metadata: {
          engine: 'google-cloud-vision',
          model: 'DOCUMENT_TEXT_DETECTION',
          sourceType: 'pdf',
          inputMode: 'direct-pdf',
          pageCount: pages.length,
          pages,
        },
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Google Vision error';
      throw new ServiceUnavailableException(`Google Vision PDF OCR failed: ${detail}`);
    }
  }

  private getClient() {
    this.client ??= new ImageAnnotatorClient({
      projectId: this.config.get<string>('GOOGLE_CLOUD_PROJECT') || undefined,
    });
    return this.client;
  }

  private languageHints(language: string) {
    const aliases: Record<string, string> = { spa: 'es', eng: 'en' };
    return language
      .split('+')
      .map((value) => aliases[value.trim().toLowerCase()] ?? value.trim().toLowerCase())
      .filter(Boolean);
  }

  private averageConfidence(pages: Array<{ blocks?: Array<{ confidence?: number | null }> | null }>) {
    const values = pages.flatMap((page) => page.blocks ?? []).map((block) => block.confidence).filter((value): value is number => typeof value === 'number');
    if (!values.length) return undefined;
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private detectedLanguages(pages: Array<{ property?: { detectedLanguages?: Array<{ languageCode?: string | null; confidence?: number | null }> | null } | null }>) {
    const languages = new Map<string, number | undefined>();
    for (const page of pages) {
      for (const language of page.property?.detectedLanguages ?? []) {
        if (language.languageCode) languages.set(language.languageCode, language.confidence ?? undefined);
      }
    }
    return [...languages].map(([languageCode, confidence]) => ({ languageCode, confidence }));
  }
}
