import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [MetricsModule],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
