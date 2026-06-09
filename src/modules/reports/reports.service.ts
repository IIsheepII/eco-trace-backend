import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/types';
import { toJson } from '../../common/json';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  findAll(organisationId: string) {
    return this.prisma.report.findMany({ where: { organisationId }, orderBy: { createdAt: 'desc' } });
  }

  async create(user: AuthenticatedUser, dto: CreateReportDto) {
    const started = Date.now();
    if (dto.documentId) {
      const document = await this.prisma.document.findFirst({ where: { id: dto.documentId, organisationId: user.organisationId } });
      if (!document) throw new BadRequestException('Invalid document');
    }

    const storageKey = `reports/${Date.now()}-${dto.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${dto.format.toLowerCase()}`;
    const report = await this.prisma.report.create({
      data: {
        organisationId: user.organisationId,
        requestedById: user.id,
        documentId: dto.documentId,
        title: dto.title,
        format: dto.format,
        criteria: toJson(dto.criteria ?? {}),
        storageKey,
        durationMs: Date.now() - started,
      },
    });
    await this.metrics.record(user.organisationId, 'report_generation_time', report.durationMs ?? 0, 'ms', { reportId: report.id });
    return report;
  }
}
