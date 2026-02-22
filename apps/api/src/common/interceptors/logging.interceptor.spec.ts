import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => ({
          method: 'GET',
          url: '/api/v1/health',
          headers: {},
        }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    mockCallHandler = {
      handle: vi.fn().mockReturnValue(of({ status: 'ok' })),
    };
  });

  it('should call next.handle() and return observable', async () => {
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);
    await new Promise<void>((resolve, reject) => {
      result.subscribe({
        next: (value) => {
          expect(value).toEqual({ status: 'ok' });
          expect(mockCallHandler.handle).toHaveBeenCalled();
          resolve();
        },
        error: reject,
      });
    });
  });

  it('should propagate requestId from header when present', async () => {
    const requestId = 'test-request-id-123';
    const request: Record<string, unknown> = {
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': requestId },
    };
    mockExecutionContext = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => request,
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(request.requestId).toBe(requestId);
          resolve();
        },
        error: reject,
      });
    });
  });
});
