import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { OrganisationsService } from './organisations.service';

@ApiTags('Organisations')
@ApiCookieAuth('access_token')
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisations: OrganisationsService) {}

  @Get()
  @Permissions('organisations:manage')
  findAll() {
    return this.organisations.findAll();
  }

  @Post()
  @Permissions('organisations:manage')
  create(@Body() dto: CreateOrganisationDto) {
    return this.organisations.create(dto);
  }
}
