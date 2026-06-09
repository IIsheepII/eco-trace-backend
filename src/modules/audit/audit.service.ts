import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organisationId: string, resource?: string) {
    return this.prisma.auditLog.findMany({
      where: { organisationId, resource },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
