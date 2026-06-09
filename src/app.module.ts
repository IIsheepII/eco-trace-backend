import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { envValidation } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { AiExtractionModule } from './modules/ai-extraction/ai-extraction.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentFieldsModule } from './modules/document-fields/document-fields.module';
import { DocumentTypesModule } from './modules/document-types/document-types.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FileStorageModule } from './modules/file-storage/file-storage.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RolesModule } from './modules/roles/roles.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { ValidationModule } from './modules/validation/validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: envValidation }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    OrganisationsModule,
    DocumentsModule,
    DocumentTypesModule,
    DocumentFieldsModule,
    FileStorageModule,
    OcrModule,
    AiExtractionModule,
    ValidationModule,
    ReportsModule,
    MetricsModule,
    AuditModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
