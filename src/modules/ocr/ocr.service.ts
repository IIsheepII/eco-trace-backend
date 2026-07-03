import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJson } from '../../common/json';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PdfConversionResult, PdfProcessingService } from '../pdf-processing/pdf-processing.service';
import { OCR_PROVIDER, OcrProvider, OcrProviderResult } from './ocr-provider';

const OCR_SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/tiff', 'image/webp']);

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly pdfProcessing: PdfProcessingService,
    @Inject(OCR_PROVIDER) private readonly ocrProvider: OcrProvider,
  ) {}

  async run(organisationId: string, documentId: string) {
    const started = Date.now();
    const language = this.config.get<string>('OCR_LANGUAGE', 'spa+eng');
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId, deletedAt: null },
      include: { uploadedFile: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!document.uploadedFile) throw new NotFoundException('Original file not found');

    this.validateOcrFile(document.uploadedFile.mimeType, document.uploadedFile.sizeBytes);
    try {
      await this.storage.stat(document.uploadedFile.storageKey);
    } catch {
      throw new NotFoundException('Original file not found');
    }

    const job = await this.prisma.processingJob.create({
      data: {
        documentId,
        type: 'OCR',
        status: ProcessingJobStatus.RUNNING,
        startedAt: new Date(started),
        output: { language, engine: this.config.get<string>('OCR_ENGINE', 'tesseract') },
      },
    });
    await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.OCR_PENDING } });

    try {
      const filePath = this.storage.resolveStoragePath(document.uploadedFile.storageKey);
      const result = await this.extractTextFromStoredFile(filePath, document.uploadedFile.mimeType, language);
      const finishedAt = new Date();
      const durationMs = Date.now() - started;
      const rawText = result.rawText.trim();
      const ocrResult = await this.prisma.ocrResult.create({
        data: {
          documentId,
          processingJobId: job.id,
          rawText,
          language,
          confidence: result.confidence,
          characterCount: rawText.length,
          processingTimeMs: durationMs,
          status: ProcessingJobStatus.COMPLETED,
          metadata: toJson(result.metadata ?? {}),
        },
      });

      const completedJob = await this.prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: ProcessingJobStatus.COMPLETED,
          finishedAt,
          durationMs,
          output: toJson({
            text: rawText,
            language,
            characterCount: rawText.length,
            ocrResultId: ocrResult.id,
            metadata: result.metadata ?? {},
          }),
        },
      });
      await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.OCR_COMPLETED } });
      await this.prisma.auditLog.create({
        data: {
          organisationId,
          documentId,
          action: 'OCR_COMPLETED',
          resource: 'documents',
          resourceId: documentId,
          metadata: toJson({ processingJobId: job.id, ocrResultId: ocrResult.id, characterCount: rawText.length }),
        },
      });
      this.logger.log(`OCR completed for document ${documentId} with ${rawText.length} characters`);
      return { job: completedJob, ocrResult };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = error instanceof Error ? error.message : 'OCR failed';
      await this.prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: ProcessingJobStatus.FAILED,
          finishedAt: new Date(),
          durationMs,
          errorMessage: message,
          output: toJson({ language, error: message }),
        },
      });
      await this.prisma.ocrResult.create({
        data: {
          documentId,
          processingJobId: job.id,
          rawText: '',
          language,
          characterCount: 0,
          processingTimeMs: durationMs,
          status: ProcessingJobStatus.FAILED,
          errorMessage: message,
          metadata: toJson({ engine: this.config.get<string>('OCR_ENGINE', 'tesseract') }),
        },
      });
      await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.OCR_FAILED } });
      await this.prisma.auditLog.create({
        data: {
          organisationId,
          documentId,
          action: 'OCR_FAILED',
          resource: 'documents',
          resourceId: documentId,
          metadata: toJson({ processingJobId: job.id }),
        },
      });
      this.logger.error(`OCR failed for document ${documentId}: ${message}`);
      throw error;
    }
  }

  async findResult(organisationId: string, documentId: string) {
    await this.ensureDocumentAccess(organisationId, documentId);
    const result = await this.prisma.ocrResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    if (!result) throw new NotFoundException('OCR result not found');
    return result;
  }

  async getProcessingStatus(organisationId: string, documentId: string) {
    const document = await this.ensureDocumentAccess(organisationId, documentId);
    const latestJob = await this.prisma.processingJob.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    const latestOcrResult = await this.prisma.ocrResult.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      documentId,
      documentStatus: document.status,
      processingJob: latestJob,
      ocrResult: latestOcrResult
        ? {
            id: latestOcrResult.id,
            status: latestOcrResult.status,
            language: latestOcrResult.language,
            characterCount: latestOcrResult.characterCount,
            processingTimeMs: latestOcrResult.processingTimeMs,
            errorMessage: latestOcrResult.errorMessage,
          }
        : null,
    };
  }

  private validateOcrFile(mimeType: string, sizeBytes: number) {
    if (mimeType !== 'application/pdf' && !OCR_SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported OCR file type');
    }
    const maxBytes = this.config.get<number>('OCR_MAX_FILE_SIZE_MB', 10) * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      throw new BadRequestException(`OCR file size exceeds ${this.config.get<number>('OCR_MAX_FILE_SIZE_MB', 10)}MB`);
    }
  }

  private async extractTextFromStoredFile(filePath: string, mimeType: string, language: string): Promise<OcrProviderResult> {
    if (this.pdfProcessing.isPdf(mimeType, filePath)) {
      return this.extractPdfText(filePath, language);
    }

    const started = Date.now();
    const result = await this.ocrProvider.extractText({ filePath, language });
    return {
      rawText: result.rawText,
      confidence: result.confidence,
      metadata: {
        ...(result.metadata ?? {}),
        sourceType: 'image',
        pageCount: 1,
        ocrTimeMs: Date.now() - started,
      },
    };
  }

  private async extractPdfText(filePath: string, language: string): Promise<OcrProviderResult> {
    let conversion: PdfConversionResult | undefined;
    const ocrStarted = Date.now();
    let tempFilesCleaned = false;
    try {
      conversion = await this.pdfProcessing.convertPdfToImages(filePath);
      const pages = [];
      for (const [index, imagePath] of conversion.imagePaths.entries()) {
        const pageStarted = Date.now();
        const result = await this.ocrProvider.extractText({ filePath: imagePath, language });
        pages.push({
          page: index + 1,
          text: result.rawText.trim(),
          ocrTimeMs: Date.now() - pageStarted,
          metadata: result.metadata ?? {},
        });
      }
      tempFilesCleaned = await this.pdfProcessing.cleanupTempDir(conversion.tempDir);
      const rawText = pages.map((page) => `--- Page ${page.page} ---\n${page.text}`).join('\n\n').trim();
      return {
        rawText,
        metadata: {
          sourceType: 'pdf',
          pagesConverted: conversion.imagePaths.length,
          pageCount: conversion.pageCount,
          dpi: conversion.dpi,
          imageFormat: conversion.imageFormat,
          conversionTimeMs: conversion.conversionTimeMs,
          ocrTimeMs: Date.now() - ocrStarted,
          tempFilesCleaned,
          popplerVersion: conversion.popplerVersion,
          pages,
        },
      };
    } catch (error) {
      if (conversion) {
        tempFilesCleaned = await this.pdfProcessing.cleanupTempDir(conversion.tempDir).catch(() => false);
      }
      if (error instanceof Error && tempFilesCleaned) {
        Object.assign(error, { tempFilesCleaned });
      }
      throw error;
    }
  }

  private async ensureDocumentAccess(organisationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }
}
