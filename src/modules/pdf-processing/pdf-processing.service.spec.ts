import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PdfProcessingService } from './pdf-processing.service';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  mkdtemp: jest.fn().mockResolvedValue('D:/project/tmp/ocr/pdf-abc'),
  readdir: jest.fn().mockResolvedValue(['page-1.png', 'page-2.png']),
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('PdfProcessingService', () => {
  const execFileMock = execFile as unknown as jest.Mock;

  function service(overrides: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = {
      OCR_TEMP_DIR: 'D:/project/tmp/ocr',
      OCR_CLEAN_TEMP_FILES: true,
      POPPLER_PATH: '',
      PDF_CONVERSION_DPI: 200,
      PDF_CONVERSION_FORMAT: 'png',
      PDF_MAX_PAGES: 20,
      ...overrides,
    };
    return new PdfProcessingService({
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => values[key] ?? fallback),
    } as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    execFileMock.mockImplementation((command: string, args: string[], _options: unknown, callback: CallableFunction) => {
      if (command === 'pdfinfo') callback(null, { stdout: 'Pages: 2\n', stderr: '' });
      else if (args.includes('-v')) callback(null, { stdout: 'pdftoppm version 24.0', stderr: '' });
      else callback(null, { stdout: '', stderr: '' });
    });
  });

  it('detects PDF files', () => {
    const subject = service();

    expect(subject.isPdf('application/pdf')).toBe(true);
    expect(subject.isPdf('image/png', 'invoice.pdf')).toBe(true);
    expect(subject.isPdf('image/png', 'invoice.png')).toBe(false);
  });

  it('converts a PDF into ordered image paths', async () => {
    const subject = service();

    const result = await subject.convertPdfToImages('D:/uploads/invoice.pdf');

    expect(mkdtemp).toHaveBeenCalled();
    expect(result).toMatchObject({ pageCount: 2, dpi: 200, imageFormat: 'png' });
    expect(result.imagePaths).toEqual([join('D:/project/tmp/ocr/pdf-abc', 'page-1.png'), join('D:/project/tmp/ocr/pdf-abc', 'page-2.png')]);
    expect(execFileMock).toHaveBeenCalledWith('pdftoppm', ['-png', '-r', '200', 'D:/uploads/invoice.pdf', join('D:/project/tmp/ocr/pdf-abc', 'page')], expect.any(Object), expect.any(Function));
  });

  it('rejects PDFs over the configured page limit', async () => {
    execFileMock.mockImplementation((command: string, _args: string[], _options: unknown, callback: CallableFunction) => {
      if (command === 'pdfinfo') callback(null, { stdout: 'Pages: 21\n', stderr: '' });
    });

    await expect(service({ PDF_MAX_PAGES: 20 }).convertPdfToImages('D:/uploads/large.pdf')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('wraps Poppler execution errors', async () => {
    execFileMock.mockImplementation((_command: string, _args: string[], _options: unknown, callback: CallableFunction) => {
      callback(new Error('pdftoppm not found'));
    });

    await expect(service().convertPdfToImages('D:/uploads/broken.pdf')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('cleans temporary files when enabled', async () => {
    await expect(service().cleanupTempDir('D:/project/tmp/ocr/pdf-abc')).resolves.toBe(true);
    expect(rm).toHaveBeenCalledWith(resolve('D:/project/tmp/ocr/pdf-abc'), { recursive: true, force: true });
  });

  it('skips cleanup when disabled', async () => {
    await expect(service({ OCR_CLEAN_TEMP_FILES: false }).cleanupTempDir('D:/project/tmp/ocr/pdf-abc')).resolves.toBe(false);
    expect(rm).not.toHaveBeenCalled();
    expect(readdir).not.toHaveBeenCalledWith('unused');
  });
});
