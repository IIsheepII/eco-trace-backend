import { Controller, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { OcrService } from './ocr.service';

@ApiTags('OCR')
@ApiCookieAuth('access_token')
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post('documents/:documentId/run')
  @Permissions('documents:manage')
  run(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.ocr.run(user.organisationId, documentId);
  }
}
