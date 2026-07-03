import { Module } from '@nestjs/common';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { PdfProcessingModule } from '../pdf-processing/pdf-processing.module';
import { DocumentsOcrController } from './documents-ocr.controller';
import { OcrController } from './ocr.controller';
import { OCR_PROVIDER } from './ocr-provider';
import { OcrService } from './ocr.service';
import { TesseractCliProvider } from './tesseract-cli.provider';

@Module({
  imports: [FileStorageModule, PdfProcessingModule],
  controllers: [OcrController, DocumentsOcrController],
  providers: [
    TesseractCliProvider,
    { provide: OCR_PROVIDER, useExisting: TesseractCliProvider },
    OcrService,
  ],
  exports: [OcrService],
})
export class OcrModule {}
