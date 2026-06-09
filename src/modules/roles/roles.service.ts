import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organisationId: string) {
    return this.prisma.role.findMany({ where: { OR: [{ organisationId }, { organisationId: null }] }, orderBy: { name: 'asc' } });
  }

  create(organisationId: string, dto: CreateRoleDto) {
    return this.prisma.role.create({ data: { ...dto, organisationId } });
  }
}
