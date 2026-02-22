import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  const createMockContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  it('should return true when X-API-Key matches configured key', () => {
    const config = { get: vi.fn((key: string) => (key === 'auth.apiKey' ? 'secret-key' : undefined)) };
    const guard = new ApiKeyGuard(config as ConfigService);
    const ctx = createMockContext({ 'x-api-key': 'secret-key' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException when API Key is not configured', () => {
    const config = { get: vi.fn(() => undefined) };
    const guard = new ApiKeyGuard(config as ConfigService);
    const ctx = createMockContext({ 'x-api-key': 'any' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('API Key authentication is not configured');
  });

  it('should throw UnauthorizedException when header is missing', () => {
    const config = { get: vi.fn((key: string) => (key === 'auth.apiKey' ? 'secret-key' : undefined)) };
    const guard = new ApiKeyGuard(config as ConfigService);
    const ctx = createMockContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow('Invalid or missing API Key');
  });

  it('should throw UnauthorizedException when header does not match', () => {
    const config = { get: vi.fn((key: string) => (key === 'auth.apiKey' ? 'secret-key' : undefined)) };
    const guard = new ApiKeyGuard(config as ConfigService);
    const ctx = createMockContext({ 'x-api-key': 'wrong-key' });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
