import { Injectable } from '@nestjs/common';
import { toJson } from '../../common/json';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  record(organisationId: string | null, name: string, value: number, unit: string, dimensions: Record<string, unknown> = {}) {
    return this.prisma.metric.create({
      data: { organisationId, name, value, unit, dimensions: toJson(dimensions) },
    });
  }

  findAll(organisationId: string, name?: string) {
    return this.prisma.metric.findMany({
      where: { organisationId, name },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    });
  }
}
