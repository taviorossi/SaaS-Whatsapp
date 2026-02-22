import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * AuthModule provides Clerk JWT validation via JwtAuthGuard (in common/guards).
 * The frontend uses Clerk for login/register/refresh; the backend only validates
 * the Bearer JWT and extracts userId/role. No login, register or refresh endpoints.
 */
@Global()
@Module({
  imports: [ConfigModule],
  exports: [ConfigModule],
})
export class AuthModule {}
