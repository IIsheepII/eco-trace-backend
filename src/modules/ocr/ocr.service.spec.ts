import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { OcrService } from './ocr.service';
import { OcrProvider } from './ocr-provider';

describe('OcrService', () => {
  const document = {
    id: 'doc-1',
    status: DocumentStatus.OCR_PENDING,
    uploadedFile: {
      storageKey: 'file.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
    },
  };

  function setup(providerOverrides: Partial<OcrProvider> = {}) {
    const prisma = {
      document: {
        findFirst: jest.fn().mockResolvedValue(document),
        update: jest.fn().mockResolvedValue({}),
      },
      processingJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'job-1', ...data })),
        findFirst: jest.fn().mockResolvedValue({ id: 'job-1' }),
      },
      ocrResult: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ocr-1', ...data })),
        findFirst: jest.fn().mockResolvedValue({ id: 'ocr-1', status: ProcessingJobStatus.COMPLETED }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          OCR_LANGUAGE: 'spa+eng',
          OCR_ENGINE: 'tesseract',
          OCR_MAX_FILE_SIZE_MB: 10,
        };
        return values[key] ?? fallback;
      }),
    };
    const storage = {
      stat: jest.fn().mockResolvedValue({}),
      resolveStoragePath: jest.fn().mockReturnValue('D:/uploads/file.png'),
    };
    const pdfProcessing = {
      isPdf: jest.fn().mockImplementation((mimeType: string) => mimeType === 'application/pdf'),
      convertPdfToImages: jest.fn().mockResolvedValue({
        imagePaths: ['D:/tmp/page-1.png', 'D:/tmp/page-2.png'],
        tempDir: 'D:/tmp/pdf-1',
        pageCount: 2,
        dpi: 200,
        imageFormat: 'png',
        conversionTimeMs: 120,
        popplerVersion: 'pdftoppm version test',
      }),
      cleanupTempDir: jest.fn().mockResolvedValue(true),
    };
    const provider: OcrProvider = {
      extractText: jest.fn().mockResolvedValue({ rawText: 'Factura FAC-001 Total 99.90', metadata: { engine: 'test' } }),
      ...providerOverrides,
    };

    return {
      service: new OcrService(prisma as never, config as never, storage as never, pdfProcessing as never, provider),
      prisma,
      storage,
      pdfProcessing,
      provider,
    };
  }

  it('runs OCR and stores an OcrResult', async () => {
    const { service, prisma, provider } = setup();

    const result = await service.run('org-1', 'doc-1');

    expect(provider.extractText).toHaveBeenCalledWith({ filePath: 'D:/uploads/file.png', language: 'spa+eng' });
    expect(prisma.ocrResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rawText: 'Factura FAC-001 Total 99.90', characterCount: 27, status: ProcessingJobStatus.COMPLETED }),
    }));
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { status: DocumentStatus.OCR_COMPLETED } });
    expect(result.ocrResult.id).toBe('ocr-1');
  });

  it('converts PDF pages and runs OCR for each generated image', async () => {
    const { service, prisma, pdfProcessing, provider } = setup();
    prisma.document.findFirst.mockResolvedValue({ ...document, uploadedFile: { ...document.uploadedFile, mimeType: 'application/pdf' } });

    await service.run('org-1', 'doc-1');

    expect(pdfProcessing.convertPdfToImages).toHaveBeenCalledWith('D:/uploads/file.png');
    expect(provider.extractText).toHaveBeenCalledTimes(2);
    expect(pdfProcessing.cleanupTempDir).toHaveBeenCalledWith('D:/tmp/pdf-1');
    expect(prisma.ocrResult.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        rawText: expect.stringContaining('--- Page 1 ---'),
        metadata: expect.objectContaining({ sourceType: 'pdf', pagesConverted: 2, tempFilesCleaned: true }),
      }),
    }));
  });

  it('returns not found when the document does not exist', async () => {
    const { service, prisma } = setup();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(service.run('org-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks the job and document as failed when Tesseract fails', async () => {
    const { service, prisma } = setup({
      extractText: jest.fn().mockRejectedValue(new ServiceUnavailableException('Tesseract OCR failed')),
    });

    await expect(service.run('org-1', 'doc-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.processingJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ProcessingJobStatus.FAILED }),
    }));
    expect(prisma.document.update).toHaveBeenCalledWith({ where: { id: 'doc-1' }, data: { status: DocumentStatus.OCR_FAILED } });
  });
});
