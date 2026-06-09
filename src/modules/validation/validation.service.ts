import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ValidationStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { ValidateDocumentDto } from './dto/validate-document.dto';

@Injectable()
export class ValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async validateDocument(user: AuthenticatedUser, documentId: string, dto: ValidateDocumentDto) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organisationId: user.organisationId, deletedAt: null },
      include: { documentType: { include: { fieldDefinitions: true } }, extractedFields: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (!dto.fields.length) throw new BadRequestException('At least one field must be validated');

    const definitions = new Set(document.documentType.fieldDefinitions.map((field) => field.id));
    const extracted = new Map(document.extractedFields.map((field) => [field.id, field]));
    for (const field of dto.fields) {
      if (!definitions.has(field.fieldDefinitionId)) throw new BadRequestException('Field does not belong to document type');
      if (field.extractedFieldId && !extracted.has(field.extractedFieldId)) {
        throw new BadRequestException('Extracted field does not belong to document');
      }
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const validationRecord = await tx.validationRecord.create({
        data: {
          documentId,
          validatorId: user.id,
          status: ValidationStatus.APPROVED,
          notes: dto.notes,
        },
      });

      for (const field of dto.fields) {
        const aiValue = field.extractedFieldId ? extracted.get(field.extractedFieldId)?.aiValue ?? null : null;
        await tx.validatedField.upsert({
          where: { documentId_fieldDefinitionId: { documentId, fieldDefinitionId: field.fieldDefinitionId } },
          create: {
            documentId,
            fieldDefinitionId: field.fieldDefinitionId,
            extractedFieldId: field.extractedFieldId,
            finalValue: field.finalValue,
            correctedValue: aiValue === field.finalValue ? null : field.finalValue,
            status: aiValue === field.finalValue ? ValidationStatus.APPROVED : ValidationStatus.CORRECTED,
            validationRecordId: validationRecord.id,
          },
          update: {
            extractedFieldId: field.extractedFieldId,
            finalValue: field.finalValue,
            correctedValue: aiValue === field.finalValue ? null : field.finalValue,
            status: aiValue === field.finalValue ? ValidationStatus.APPROVED : ValidationStatus.CORRECTED,
            validationRecordId: validationRecord.id,
          },
        });
      }

      await tx.document.update({ where: { id: documentId }, data: { status: DocumentStatus.VALIDATED } });
      return tx.validationRecord.findUnique({
        where: { id: validationRecord.id },
        include: { fields: { include: { fieldDefinition: true, extractedField: true } } },
      });
    });

    const corrected = record?.fields.filter((field) => field.status === ValidationStatus.CORRECTED).length ?? 0;
    const total = record?.fields.length ?? 1;
    await this.metrics.record(user.organisationId, 'transcription_errors', corrected, 'count', { documentId });
    await this.metrics.record(user.organisationId, 'extraction_accuracy', ((total - corrected) / total) * 100, 'percent', { documentId });
    return record;
  }
}
