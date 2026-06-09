import { Module } from '@nestjs/common';
import { AiExtractionController } from './ai-extraction.controller';
import { AiExtractionService } from './ai-extraction.service';

@Module({
  controllers: [AiExtractionController],
  providers: [AiExtractionService],
  exports: [AiExtractionService],
})
export class AiExtractionModule {}
