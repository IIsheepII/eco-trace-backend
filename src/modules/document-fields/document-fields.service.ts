import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentFieldDto } from './dto/create-document-field.dto';

@Injectable()
export class DocumentFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentFieldDto) {
    const type = await this.prisma.documentType.findUnique({ where: { id: dto.documentTypeId } });
    if (!type?.isActive) throw new BadRequestException('Invalid document type');
    return this.prisma.documentFieldDefinition.create({ data: dto });
  }
}
