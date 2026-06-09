import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { CreateDocumentDto } from './dto/create-document.dto';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiCookieAuth('access_token')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('upload')
  @Permissions('documents:manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentTypeId', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentTypeId: { type: 'string' },
        title: { type: 'string' },
        metadata: { type: 'string', description: 'Optional JSON object string.' },
      },
    },
  })
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto, @UploadedFile() file: Express.Multer.File) {
    return this.documents.upload(user, dto, file);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchDocumentsDto) {
    return this.documents.search(user.organisationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.findOne(user.organisationId, id);
  }
}
