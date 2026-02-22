import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let configService: Partial<ConfigService>;

  const createMockContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: headers.authorization } }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'auth.clerkJwtIssuer') return 'https://clerk.example.com';
        return undefined;
      }),
    };
    guard = new JwtAuthGuard(configService as ConfigService);
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const ctx = createMockContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Missing or invalid Authorization header',
    );
  });

  it('should throw UnauthorizedException when Authorization is not Bearer', async () => {
    const ctx = createMockContext({ authorization: 'Basic xyz' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when Clerk JWT issuer is not configured', async () => {
    const configWithoutIssuer = { get: vi.fn(() => undefined) };
    const guardNoConfig = new JwtAuthGuard(configWithoutIssuer as ConfigService);
    const ctx = createMockContext({ authorization: 'Bearer some.jwt.token' });

    await expect(guardNoConfig.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
