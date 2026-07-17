import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleVisionProvider } from './google-vision.provider';
import { OcrDocumentInput, OcrEngine, OcrProvider, OcrProviderInput, OcrProviderResult } from './ocr-provider';
import { TesseractCliProvider } from './tesseract-cli.provider';

@Injectable()
export class ConfiguredOcrProvider implements OcrProvider {
  private readonly logger = new Logger(ConfiguredOcrProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly tesseract: TesseractCliProvider,
    private readonly googleVision: GoogleVisionProvider,
  ) {}

  async extractText(input: OcrProviderInput): Promise<OcrProviderResult> {
    const primaryEngine = input.engine ?? this.engine('OCR_ENGINE', 'tesseract');
    try {
      return await this.provider(primaryEngine).extractText(input);
    } catch (primaryError) {
      if (input.engine) throw primaryError;
      const fallbackEngine = this.engine('OCR_FALLBACK_ENGINE', 'tesseract');
      if (fallbackEngine === 'none' || fallbackEngine === primaryEngine) throw primaryError;

      this.logger.warn(`OCR engine ${primaryEngine} failed; using ${fallbackEngine} fallback`);
      const result = await this.provider(fallbackEngine).extractText(input);
      return {
        ...result,
        metadata: {
          ...(result.metadata ?? {}),
          fallbackFrom: primaryEngine,
          primaryFailure: 'OCR_PROVIDER_FAILED',
        },
      };
    }
  }

  async extractDocument(input: OcrDocumentInput): Promise<OcrProviderResult> {
    const engine = this.engine('OCR_ENGINE', 'tesseract');
    const provider = this.provider(engine);
    if (!provider.extractDocument) {
      throw new ServiceUnavailableException(`OCR engine ${engine} does not support direct document processing`);
    }
    return provider.extractDocument(input);
  }

  private engine(key: string, defaultValue: OcrEngine): OcrEngine {
    return this.config.get<string>(key, defaultValue).toLowerCase() as OcrEngine;
  }

  private provider(engine: OcrEngine): OcrProvider {
    if (engine === 'google-vision') return this.googleVision;
    if (engine === 'tesseract') return this.tesseract;
    throw new ServiceUnavailableException('No OCR provider is configured');
  }
}
