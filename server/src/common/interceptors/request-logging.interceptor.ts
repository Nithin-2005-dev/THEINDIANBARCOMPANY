import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, finalize } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { user?: { userId?: string }; requestId?: string }
      >();
    const response = context.switchToHttp().getResponse<{
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      headersSent?: boolean;
    }>();
    const startedAt = Date.now();
    const requestId =
      String(request.headers['x-request-id'] ?? '') || crypto.randomUUID();

    request.requestId = requestId;
    if ('headersSent' in response ? !response.headersSent : true) {
      response.setHeader('x-request-id', requestId);
    }

    return next.handle().pipe(
      finalize(() => {
        const payload = JSON.stringify({
          requestId,
          method: request.method,
          path: request.url,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
          userId: request.user?.userId,
          ip:
            request.headers['x-forwarded-for'] ??
            request.ip ??
            request.connection?.remoteAddress,
        });

        if (response.statusCode >= 500) {
          this.logger.error(payload);
          return;
        }

        if (response.statusCode >= 400) {
          this.logger.warn(payload);
          return;
        }

        this.logger.log(payload);
      }),
    );
  }
}
