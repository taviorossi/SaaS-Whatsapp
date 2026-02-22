import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
    startTime?: number;
  }
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId =
      (request.headers['x-request-id'] as string) ?? randomUUID();
    request.requestId = requestId;
    request.startTime = Date.now();

    const method = request.method;
    const path = request.url;

    this.logger.log(
      JSON.stringify({
        requestId,
        event: 'request_start',
        method,
        path,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const reply = ctx.getResponse();
          const statusCode = reply.statusCode ?? 500;
          const duration = request.startTime
            ? Date.now() - request.startTime
            : 0;
          this.logger.log(
            JSON.stringify({
              requestId,
              event: 'request_end',
              method,
              path,
              statusCode,
              durationMs: duration,
            }),
          );
        },
        error: () => {
          const reply = ctx.getResponse();
          const statusCode = reply.statusCode ?? 500;
          const duration = request.startTime
            ? Date.now() - request.startTime
            : 0;
          this.logger.log(
            JSON.stringify({
              requestId,
              event: 'request_end',
              method,
              path,
              statusCode,
              durationMs: duration,
            }),
          );
        },
      }),
    );
  }
}
