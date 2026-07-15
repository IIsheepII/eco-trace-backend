import { execFile } from 'node:child_process';
import { ServiceUnavailableException } from '@nestjs/common';
import { TesseractCliProvider } from './tesseract-cli.provider';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

describe('TesseractCliProvider', () => {
  const execFileMock = execFile as unknown as jest.Mock;

  function provider(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      TESSERACT_PATH: 'tesseract',
      OCR_TESSERACT_OEM: 1,
      OCR_TESSERACT_PSM: 6,
      ...overrides,
    };
    return new TesseractCliProvider({
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => values[key] ?? fallback),
    } as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes OCR language, OEM and PSM to the Tesseract CLI', async () => {
    execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: CallableFunction) => {
      callback(null, { stdout: 'OCR text', stderr: '' });
    });

    const result = await provider({ OCR_TESSERACT_OEM: 1, OCR_TESSERACT_PSM: 6 }).extractText({
      filePath: 'D:/tmp/page-1.png',
      language: 'spa+eng',
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'tesseract',
      ['D:/tmp/page-1.png', 'stdout', '-l', 'spa+eng', '--oem', '1', '--psm', '6'],
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toMatchObject({ rawText: 'OCR text', metadata: { oem: 1, psm: 6 } });
  });

  it('allows a per-call PSM override for enhanced PDF OCR passes', async () => {
    execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: CallableFunction) => {
      callback(null, { stdout: 'Sparse text', stderr: '' });
    });

    const result = await provider().extractText({
      filePath: 'D:/tmp/page-2.png',
      language: 'spa+eng',
      psm: 11,
      profile: 'pdf-enhanced-sparse-text',
    });

    expect(execFileMock).toHaveBeenCalledWith(
      'tesseract',
      ['D:/tmp/page-2.png', 'stdout', '-l', 'spa+eng', '--oem', '1', '--psm', '11'],
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toMatchObject({ rawText: 'Sparse text', metadata: { psm: 11, profile: 'pdf-enhanced-sparse-text' } });
  });

  it('wraps Tesseract execution failures', async () => {
    execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: CallableFunction) => {
      callback(new Error('not found'));
    });

    await expect(provider().extractText({ filePath: 'missing.png', language: 'spa+eng' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
