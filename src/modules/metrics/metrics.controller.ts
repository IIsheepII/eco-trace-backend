import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics')
@ApiCookieAuth('access_token')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Permissions('reports:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('name') name?: string) {
    return this.metrics.findAll(user.organisationId, name);
  }
}
