import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AiExtractionService {
  constructor(private readonly prisma: PrismaService) {}

  async run(organisationId: string, documentId: string) {
    const started = Date.now();
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId, deletedAt: null },
      include: { documentType: { include: { fieldDefinitions: { orderBy: { order: 'asc' } } } } },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.prisma.extractedField.deleteMany({ where: { documentId } });
    const extracted = await Promise.all(
      document.documentType.fieldDefinitions.map((field) =>
        this.prisma.extractedField.create({
          data: {
            documentId,
            fieldDefinitionId: field.id,
            aiValue: field.required ? `AI_${field.name}` : null,
            confidence: field.required ? 0.82 : 0.55,
            source: 'ai-placeholder',
            rawPayload: { hint: field.extractionHint },
          },
        }),
      ),
    );

    const job = await this.prisma.processingJob.create({
      data: {
        documentId,
        type: 'AI_EXTRACTION',
        status: ProcessingJobStatus.COMPLETED,
        startedAt: new Date(started),
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        output: { extractedFieldCount: extracted.length },
      },
    });
    await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.VALIDATION_PENDING } });
    return { job, extracted };
  }
}
