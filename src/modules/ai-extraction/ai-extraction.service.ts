import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ProcessingJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJson } from '../../common/json';

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
    const ocrResult = await this.prisma.ocrResult.findFirst({
      where: { documentId, status: ProcessingJobStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
    });
    const ocrText = ocrResult?.rawText ?? '';

    await this.prisma.extractedField.deleteMany({ where: { documentId } });
    const extracted = await Promise.all(
      document.documentType.fieldDefinitions.map((field) => {
        const aiValue = this.extractFieldValue(ocrText, field.name, field.label, field.extractionHint);
        return this.prisma.extractedField.create({
          data: {
            documentId,
            fieldDefinitionId: field.id,
            aiValue,
            confidence: aiValue ? 0.72 : 0.25,
            source: ocrResult ? 'ocr-rule-extraction' : 'ocr-unavailable',
            rawPayload: toJson({ hint: field.extractionHint, ocrResultId: ocrResult?.id }),
          },
        });
      }),
    );

    const job = await this.prisma.processingJob.create({
      data: {
        documentId,
        type: 'AI_EXTRACTION',
        status: ProcessingJobStatus.COMPLETED,
        startedAt: new Date(started),
        finishedAt: new Date(),
        durationMs: Date.now() - started,
        output: toJson({ extractedFieldCount: extracted.length, ocrResultId: ocrResult?.id }),
      },
    });
    await this.prisma.document.update({ where: { id: documentId }, data: { status: DocumentStatus.VALIDATION_PENDING } });
    return { job, extracted };
  }

  private extractFieldValue(text: string, name: string, label: string, hint?: string | null) {
    if (!text.trim()) return null;
    const key = `${name} ${label} ${hint ?? ''}`.toLowerCase();
    if (/(invoice|factura).*(number|n[uú]mero|nro)|invoice_number/.test(key)) {
      return this.firstMatch(text, [
        /(?:invoice|factura)\s*(?:number|n[uú]mero|no\.?|nro\.?|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-\/]{2,})/i,
        /\b(?:INV|FAC|F)\s*[-:]?\s*([A-Z0-9-]{3,})\b/i,
      ]);
    }
    if (/(date|fecha|issue)/.test(key)) {
      return this.firstMatch(text, [
        /(?:date|fecha|emisi[oó]n|issue)\s*[:#-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
        /\b(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/,
      ]);
    }
    if (/(total|amount|importe|monto)/.test(key)) {
      return this.firstMatch(text, [
        /(?:total|amount|importe|monto)\s*[:#-]?\s*(?:USD|US\$|\$|S\/)?\s*([0-9]+(?:[.,][0-9]{2})?)/i,
        /(?:USD|US\$|\$|S\/)\s*([0-9]+(?:[.,][0-9]{2})?)/i,
      ]);
    }
    return null;
  }

  private firstMatch(text: string, patterns: RegExp[]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
    return null;
  }
}
