import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiCookieAuth('access_token')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions('settings:manage')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('resource') resource?: string) {
    return this.audit.findAll(user.organisationId, resource);
  }
}
