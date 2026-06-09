import { Module } from '@nestjs/common';
import { DocumentFieldsController } from './document-fields.controller';
import { DocumentFieldsService } from './document-fields.service';

@Module({
  controllers: [DocumentFieldsController],
  providers: [DocumentFieldsService],
})
export class DocumentFieldsModule {}
