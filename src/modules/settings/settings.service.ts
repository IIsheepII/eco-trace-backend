import { Injectable } from '@nestjs/common';
import { toJson } from '../../common/json';
import { PrismaService } from '../../database/prisma.service';
import { UpsertSettingDto } from './dto/upsert-setting.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organisationId: string) {
    return this.prisma.setting.findMany({ where: { organisationId }, orderBy: { key: 'asc' } });
  }

  upsert(organisationId: string, dto: UpsertSettingDto) {
    return this.prisma.setting.upsert({
      where: { organisationId_key: { organisationId, key: dto.key } },
      create: { organisationId, key: dto.key, value: toJson(dto.value) },
      update: { value: toJson(dto.value) },
    });
  }
}
