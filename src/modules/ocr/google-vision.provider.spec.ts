import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleVisionProvider } from './google-vision.provider';

jest.mock('@google-cloud/vision', () => {
  const actual = jest.requireActual('@google-cloud/vision');
  return { ...actual, ImageAnnotatorClient: jest.fn() };
});

describe('GoogleVisionProvider', () => {
  const batchAnnotateImages = jest.fn();
  const batchAnnotateFiles = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (ImageAnnotatorClient as unknown as jest.Mock).mockImplementation(() => ({ batchAnnotateImages, batchAnnotateFiles }));
  });

  it('extracts all pages directly from a local PDF', async () => {
    batchAnnotateFiles.mockResolvedValue([
      {
        responses: [
          {
            responses: [
              { fullTextAnnotation: { text: 'Page one', pages: [{ blocks: [{ confidence: 0.9 }] }] } },
              { fullTextAnnotation: { text: 'Page two', pages: [{ blocks: [{ confidence: 0.8 }] }] } },
            ],
          },
        ],
      },
    ]);
    const provider = new GoogleVisionProvider(
      new ConfigService({ GOOGLE_CLOUD_PROJECT: 'avrilredsoft-development', GOOGLE_CLOUD_VISION_TIMEOUT_MS: 10_000 }),
    );

    const result = await provider.extractDocument({ filePath: __filename, mimeType: 'application/pdf', language: 'spa+eng' });

    expect(result.rawText).toContain('--- Page 1 ---\nPage one');
    expect(result.rawText).toContain('--- Page 2 ---\nPage two');
    expect(result.confidence).toBeCloseTo(0.85);
    expect(result.metadata).toEqual(expect.objectContaining({ inputMode: 'direct-pdf', pageCount: 2 }));
  });

  it('extracts document text with Spanish and English hints', async () => {
    batchAnnotateImages.mockResolvedValue([
      {
        responses: [
          {
            fullTextAnnotation: {
              text: 'MANIFIESTO 2026',
              pages: [{ blocks: [{ confidence: 0.9 }, { confidence: 0.8 }] }],
            },
          },
        ],
      },
    ]);
    const provider = new GoogleVisionProvider(
      new ConfigService({ GOOGLE_CLOUD_PROJECT: 'avrilredsoft-development', GOOGLE_CLOUD_VISION_TIMEOUT_MS: 10_000 }),
    );

    const result = await provider.extractText({ filePath: __filename, language: 'spa+eng' });

    expect(result.rawText).toBe('MANIFIESTO 2026');
    expect(result.confidence).toBeCloseTo(0.85);
    expect(batchAnnotateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [expect.objectContaining({ imageContext: { languageHints: ['es', 'en'] } })],
      }),
      { timeout: 10_000 },
    );
  });

  it('surfaces API response errors as unavailable', async () => {
    batchAnnotateImages.mockResolvedValue([{ responses: [{ error: { message: 'permission denied' } }] }]);
    const provider = new GoogleVisionProvider(new ConfigService({ GOOGLE_CLOUD_PROJECT: 'avrilredsoft-development' }));

    await expect(provider.extractText({ filePath: __filename, language: 'spa' })).rejects.toThrow(
      'Google Vision OCR failed: permission denied',
    );
  });
});
