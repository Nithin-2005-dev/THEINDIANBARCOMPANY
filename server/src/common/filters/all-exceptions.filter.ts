import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureSentryException } from '../monitoring/sentry';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse &&
      'message' in exceptionResponse
        ? exceptionResponse.message
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    const payload = JSON.stringify({
      requestId: request.requestId,
      path: request.url,
      method: request.method,
      statusCode: status,
      error: exception instanceof Error ? exception.stack : exception,
    });

    if (status >= 500) {
      captureSentryException(exception);
      this.logger.error(payload);
    } else {
      this.logger.warn(payload);
    }

    if (response.headersSent) {
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
