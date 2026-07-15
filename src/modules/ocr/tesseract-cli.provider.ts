import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OcrProvider, OcrProviderInput, OcrProviderResult } from './ocr-provider';

const execFileAsync = promisify(execFile);

@Injectable()
export class TesseractCliProvider implements OcrProvider {
  constructor(private readonly config: ConfigService) {}

  async extractText(input: OcrProviderInput): Promise<OcrProviderResult> {
    const psm = input.psm ?? this.config.get<number>('OCR_TESSERACT_PSM', 6);
    try {
      const { stdout, stderr } = await execFileAsync(
        this.tesseractCommand(),
        [
          input.filePath,
          'stdout',
          '-l',
          input.language,
          '--oem',
          String(this.config.get<number>('OCR_TESSERACT_OEM', 1)),
          '--psm',
          String(psm),
        ],
        { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      );

      return {
        rawText: stdout.trim(),
        metadata: {
          engine: 'tesseract-cli',
          oem: this.config.get<number>('OCR_TESSERACT_OEM', 1),
          psm,
          profile: input.profile,
          stderr: stderr?.trim() || undefined,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to execute Tesseract OCR';
      throw new ServiceUnavailableException(`Tesseract OCR failed: ${message}`);
    }
  }

  private tesseractCommand() {
    return this.config.get<string>('TESSERACT_PATH', '').trim() || 'tesseract';
  }
}
