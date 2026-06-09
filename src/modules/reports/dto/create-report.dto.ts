import { ApiProperty } from '@nestjs/swagger';
import { ReportFormat } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  criteria?: Record<string, unknown>;
}
