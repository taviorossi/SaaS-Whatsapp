import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { JwtPayloadUser } from '../decorators/current-user.decorator';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwksClient: jwksClient.JwksClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getJwksClient(): jwksClient.JwksClient {
    if (!this.jwksClient) {
      const issuer = this.config.get<string>('auth.clerkJwtIssuer');
      if (!issuer) {
        throw new UnauthorizedException('Clerk JWT issuer not configured');
      }
      const jwksUri = issuer.endsWith('/')
        ? `${issuer}.well-known/jwks.json`
        : `${issuer}/.well-known/jwks.json`;
      this.jwksClient = jwksClient({
        jwksUri,
        cache: true,
        cacheMaxAge: 600000,
      });
    }
    return this.jwksClient;
  }

  private getSigningKey(header: jwt.JwtHeader): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.getJwksClient();
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          reject(err);
          return;
        }
        if (!key) {
          reject(new Error('Signing key not found'));
          return;
        }
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      });
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(BEARER_PREFIX.length);
    const issuer = this.config.get<string>('auth.clerkJwtIssuer');

    if (!issuer) {
      throw new UnauthorizedException('Clerk JWT issuer not configured');
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new UnauthorizedException('Invalid token');
      }

      const key = await this.getSigningKey(decoded.header);
      const payload = jwt.verify(token, key, {
        algorithms: ['RS256'],
        issuer,
      }) as jwt.JwtPayload & { sub?: string; role?: string };

      const user: JwtPayloadUser = {
        id: payload.sub ?? (payload as { sub?: string }).sub ?? '',
        role: payload.role ?? (payload as { role?: string }).role,
        sub: payload.sub,
      };

      (request as FastifyRequest & { user: JwtPayloadUser }).user = user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(
        err instanceof Error ? err.message : 'Invalid token',
      );
    }
  }
}
