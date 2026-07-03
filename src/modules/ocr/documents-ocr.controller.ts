import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { OcrService } from './ocr.service';

@ApiTags('Document OCR')
@ApiCookieAuth('access_token')
@Controller('documents')
export class DocumentsOcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post(':id/ocr/process')
  @Permissions('documents:manage')
  process(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocr.run(user.organisationId, id);
  }

  @Get(':id/ocr-result')
  findResult(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocr.findResult(user.organisationId, id);
  }

  @Get(':id/processing-status')
  findProcessingStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocr.getProcessingStatus(user.organisationId, id);
  }
}
