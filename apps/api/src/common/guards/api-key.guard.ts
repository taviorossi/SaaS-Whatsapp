import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

const API_KEY_HEADER = 'x-api-key';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const apiKey = this.config.get<string>('auth.apiKey');

    if (!apiKey) {
      throw new UnauthorizedException('API Key authentication is not configured');
    }

    const receivedKey = request.headers[API_KEY_HEADER];

    if (!receivedKey || receivedKey !== apiKey) {
      throw new UnauthorizedException('Invalid or missing API Key');
    }

    return true;
  }
}
