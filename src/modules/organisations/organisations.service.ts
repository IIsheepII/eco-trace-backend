import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.organisation.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }

  create(dto: CreateOrganisationDto) {
    return this.prisma.organisation.create({ data: dto });
  }
}
