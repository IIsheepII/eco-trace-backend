import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../database/prisma.service';
import { toJson } from '../../common/json';
import { MulterFile } from '../../common/types/multer-file.type';
import { FileStorageService } from '../file-storage/file-storage.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly metrics: MetricsService,
  ) {}

  async upload(user: AuthenticatedUser, dto: CreateDocumentDto, file: MulterFile) {
    const started = Date.now();
    const documentType = await this.prisma.documentType.findUnique({ where: { id: dto.documentTypeId } });
    if (!documentType?.isActive) throw new BadRequestException('Invalid document type');

    const stored = await this.storage.save(file);
    const metadata = typeof dto.metadata === 'string' ? JSON.parse(dto.metadata) as Record<string, unknown> : dto.metadata ?? {};
    const document = await this.prisma.document.create({
      data: {
        organisationId: user.organisationId,
        documentTypeId: dto.documentTypeId,
        title: dto.title,
        status: DocumentStatus.OCR_PENDING,
        metadata: toJson(metadata),
        uploadedFile: {
          create: {
            organisationId: user.organisationId,
            uploadedById: user.id,
            ...stored,
          },
        },
        processingJobs: { create: { type: 'OCR', status: 'QUEUED' } },
      },
      include: { uploadedFile: true },
    });
    await this.metrics.record(user.organisationId, 'registration_time', Date.now() - started, 'ms', { documentId: document.id });
    return document;
  }

  async search(organisationId: string, query: SearchDocumentsDto) {
    const started = Date.now();
    const documents = await this.prisma.document.findMany({
      where: {
        organisationId,
        deletedAt: null,
        documentTypeId: query.documentTypeId,
        title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
        validatedFields: query.fieldName || query.fieldValue
          ? {
              some: {
                finalValue: query.fieldValue ? { contains: query.fieldValue, mode: 'insensitive' } : undefined,
                fieldDefinition: query.fieldName ? { name: query.fieldName } : undefined,
              },
            }
          : undefined,
      },
      include: { documentType: true, uploadedFile: true, validatedFields: { include: { fieldDefinition: true } } },
      orderBy: { createdAt: 'desc' },
    });
    await this.metrics.record(organisationId, 'search_time', Date.now() - started, 'ms', { count: documents.length });
    return documents;
  }

  async findOne(organisationId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: {
        documentType: { include: { fieldDefinitions: true } },
        uploadedFile: true,
        extractedFields: { include: { fieldDefinition: true } },
        validatedFields: { include: { fieldDefinition: true } },
        processingJobs: true,
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  async getOriginalFile(organisationId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organisationId, deletedAt: null },
      include: { uploadedFile: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!document.uploadedFile) throw new NotFoundException('Original file not found');

    return {
      buffer: await this.storage.read(document.uploadedFile.storageKey),
      originalName: document.uploadedFile.originalName,
      mimeType: document.uploadedFile.mimeType,
    };
  }
}
