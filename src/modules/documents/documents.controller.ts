import { Body, Controller, Get, Header, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { MulterFile } from '../../common/types/multer-file.type';
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
  upload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto, @UploadedFile() file: MulterFile) {
    return this.documents.upload(user, dto, file);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchDocumentsDto) {
    return this.documents.search(user.organisationId, query);
  }

  @Get(':id/file')
  @Header('Cache-Control', 'private, max-age=300')
  async getOriginalFile(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const file = await this.documents.getOriginalFile(user.organisationId, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(file.buffer);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.documents.findOne(user.organisationId, id);
  }
}
