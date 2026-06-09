import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';

@Injectable()
export class DocumentTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.documentType.findMany({ include: { fieldDefinitions: { orderBy: { order: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const type = await this.prisma.documentType.findUnique({ where: { id }, include: { fieldDefinitions: { orderBy: { order: 'asc' } } } });
    if (!type) throw new NotFoundException('Document type not found');
    return type;
  }

  create(dto: CreateDocumentTypeDto) {
    return this.prisma.documentType.create({ data: dto });
  }
}
