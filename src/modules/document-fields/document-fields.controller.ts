import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateDocumentFieldDto } from './dto/create-document-field.dto';
import { DocumentFieldsService } from './document-fields.service';

@ApiTags('Document Fields')
@ApiCookieAuth('access_token')
@Controller('document-fields')
export class DocumentFieldsController {
  constructor(private readonly fields: DocumentFieldsService) {}

  @Post()
  @Permissions('documents:manage')
  create(@Body() dto: CreateDocumentFieldDto) {
    return this.fields.create(dto);
  }
}
