import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateDocumentFieldDto {
  @ApiProperty()
  @IsString()
  documentTypeId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty({ example: 'string' })
  @IsString()
  dataType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  validationRegex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  extractionHint?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  order?: number;
}
