import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesService } from './document-types.service';

@ApiTags('Document Types')
@ApiCookieAuth('access_token')
@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly types: DocumentTypesService) {}

  @Get()
  findAll() {
    return this.types.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.types.findOne(id);
  }

  @Post()
  @Permissions('documents:manage')
  create(@Body() dto: CreateDocumentTypeDto) {
    return this.types.create(dto);
  }
}
