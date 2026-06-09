import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { ValidateDocumentDto } from './dto/validate-document.dto';
import { ValidationService } from './validation.service';

@ApiTags('Validation')
@ApiCookieAuth('access_token')
@Controller('validation')
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Post('documents/:documentId')
  @Permissions('documents:validate')
  validate(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string, @Body() dto: ValidateDocumentDto) {
    return this.validation.validateDocument(user, documentId, dto);
  }
}
