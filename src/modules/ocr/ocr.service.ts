import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OcrService {
  constructor(private readonly prisma: PrismaService) {}

  async run(organisationId: string, documentId: string) {
    const started = Date.now();
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId, deletedAt: null },
      include: { uploadedFile: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!document.uploadedFile) throw new ForbiddenException('Document has no original file');

    const text = `OCR placeholder for ${document.uploadedFile.originalName}`;
    const job = await this.prisma.processingJob.create({
      data: {
        documentId,
        type: 'OCR',
        status: ProcessingJobStatus.COMPLETED,
        startedAt: new Date(started),
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        output: { text },
      },
    });
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.EXTRACTION_PENDING },
    });
    return job;
  }
}
