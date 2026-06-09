import { Controller, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AiExtractionService } from './ai-extraction.service';

@ApiTags('AI Extraction')
@ApiCookieAuth('access_token')
@Controller('ai-extraction')
export class AiExtractionController {
  constructor(private readonly extraction: AiExtractionService) {}

  @Post('documents/:documentId/run')
  @Permissions('documents:manage')
  run(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.extraction.run(user.organisationId, documentId);
  }
}
