import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { toJson } from '../json';
import { AuthenticatedRequest } from '../types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method;
    if (method === 'GET' || method === 'OPTIONS') return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = request.user;
        void this.prisma.auditLog.create({
          data: {
            organisationId: user?.organisationId,
            userId: user?.id,
            action: method,
            resource: request.route?.path ?? request.path,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            metadata: toJson({ body: sanitizeBody(request.body) }),
          },
        }).catch(() => undefined);
      }),
    );
  }
}

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const copy = { ...(body as Record<string, unknown>) };
  delete copy.password;
  delete copy.refreshToken;
  return copy;
}
