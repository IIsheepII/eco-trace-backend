import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ValidateFieldDto {
  @ApiProperty()
  @IsString()
  fieldDefinitionId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  extractedFieldId?: string;

  @ApiProperty()
  @IsString()
  finalValue: string;
}

export class ValidateDocumentDto {
  @ApiProperty({ type: [ValidateFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidateFieldDto)
  fields: ValidateFieldDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
