import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [MetricsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
