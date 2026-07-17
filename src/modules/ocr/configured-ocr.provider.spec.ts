import { ConfigService } from '@nestjs/config';
import { ConfiguredOcrProvider } from './configured-ocr.provider';
import { GoogleVisionProvider } from './google-vision.provider';
import { TesseractCliProvider } from './tesseract-cli.provider';

describe('ConfiguredOcrProvider', () => {
  it('uses Google Vision as primary provider', async () => {
    const googleVision = { extractText: jest.fn().mockResolvedValue({ rawText: 'vision' }) };
    const tesseract = { extractText: jest.fn() };
    const provider = new ConfiguredOcrProvider(
      new ConfigService({ OCR_ENGINE: 'google-vision', OCR_FALLBACK_ENGINE: 'tesseract' }),
      tesseract as unknown as TesseractCliProvider,
      googleVision as unknown as GoogleVisionProvider,
    );

    await expect(provider.extractText({ filePath: 'page.png', language: 'spa' })).resolves.toEqual({ rawText: 'vision' });
    expect(tesseract.extractText).not.toHaveBeenCalled();
  });

  it('falls back to Tesseract and records the primary failure', async () => {
    const googleVision = { extractText: jest.fn().mockRejectedValue(new Error('quota exceeded')) };
    const tesseract = { extractText: jest.fn().mockResolvedValue({ rawText: 'fallback', metadata: { engine: 'tesseract-cli' } }) };
    const provider = new ConfiguredOcrProvider(
      new ConfigService({ OCR_ENGINE: 'google-vision', OCR_FALLBACK_ENGINE: 'tesseract' }),
      tesseract as unknown as TesseractCliProvider,
      googleVision as unknown as GoogleVisionProvider,
    );

    const result = await provider.extractText({ filePath: 'page.png', language: 'spa' });

    expect(result.rawText).toBe('fallback');
    expect(result.metadata).toEqual(expect.objectContaining({ fallbackFrom: 'google-vision', primaryFailure: 'OCR_PROVIDER_FAILED' }));
  });
});
