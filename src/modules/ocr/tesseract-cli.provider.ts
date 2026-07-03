import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OcrProvider, OcrProviderInput, OcrProviderResult } from './ocr-provider';

const execFileAsync = promisify(execFile);

@Injectable()
export class TesseractCliProvider implements OcrProvider {
  async extractText(input: OcrProviderInput): Promise<OcrProviderResult> {
    try {
      const { stdout, stderr } = await execFileAsync(
        'tesseract',
        [input.filePath, 'stdout', '-l', input.language],
        { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
      );

      return {
        rawText: stdout.trim(),
        metadata: {
          engine: 'tesseract-cli',
          stderr: stderr?.trim() || undefined,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to execute Tesseract OCR';
      throw new ServiceUnavailableException(`Tesseract OCR failed: ${message}`);
    }
  }
}
