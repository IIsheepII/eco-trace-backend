import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../common/types';
import { UpsertSettingDto } from './dto/upsert-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiCookieAuth('access_token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permissions('settings:manage')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.findAll(user.organisationId);
  }

  @Put()
  @Permissions('settings:manage')
  upsert(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertSettingDto) {
    return this.settings.upsert(user.organisationId, dto);
  }
}
