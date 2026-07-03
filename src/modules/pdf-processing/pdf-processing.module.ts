import { Module } from '@nestjs/common';
import { PdfProcessingService } from './pdf-processing.service';

@Module({
  providers: [PdfProcessingService],
  exports: [PdfProcessingService],
})
export class PdfProcessingModule {}
