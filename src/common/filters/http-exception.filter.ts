import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();
    const traceId  = crypto.randomUUID();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string[]> | undefined;
    let errorCode = 'SERVER_ERROR';

    if (exception instanceof HttpException) {
      status  = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as any;
        message = b.message ?? message;

        // ValidationPipe produces { message: string[], error: 'Bad Request' }
        if (Array.isArray(b.message)) {
          errorCode = 'VALIDATION_ERROR';
          // Group flat constraint strings into { field: [error] } shape
          errors = {};
          for (const msg of b.message as string[]) {
            // class-validator format: "fieldName must be ..."
            const spaceIdx = msg.indexOf(' ');
            const field    = spaceIdx > 0 ? msg.slice(0, spaceIdx) : 'input';
            (errors[field] ??= []).push(msg);
          }
          message = 'Validation failed';
        }
      }

      errorCode = STATUS_TO_CODE[status] ?? errorCode;
      // Override to VALIDATION_ERROR for 400s that came from the ValidationPipe
      if (errors) errorCode = 'VALIDATION_ERROR';
    } else if (exception instanceof Error) {
      this.logger.error(`${request.method} ${request.url} — ${exception.message}`, exception.stack);
    }

    const body: Record<string, unknown> = {
      message,
      error_code: errorCode,
      timestamp:  new Date().toISOString(),
      trace_id:   traceId,
    };
    if (errors) body.errors = errors;

    response.status(status).json(body);
  }
}
