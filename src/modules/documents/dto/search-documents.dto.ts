import { IsOptional, IsString } from 'class-validator';

export class SearchDocumentsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  fieldName?: string;

  @IsOptional()
  @IsString()
  fieldValue?: string;
}
