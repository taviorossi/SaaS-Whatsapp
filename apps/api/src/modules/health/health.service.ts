import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

export type CheckStatus = 'up' | 'down' | 'disabled';

export interface HealthResult {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    database: CheckStatus;
    redis: CheckStatus;
  };
}

const TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async check(): Promise<HealthResult> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    const status =
      database === 'down'
        ? 'error'
        : redis === 'down'
          ? 'degraded'
          : 'ok';

    return {
      status,
      checks: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      const result = await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
        ),
      ]);
      return result ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    const redisUrl = this.config.get<string>('redis.url');
    if (!redisUrl) {
      return 'disabled';
    }

    let client: Redis | null = null;
    try {
      client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: TIMEOUT_MS,
      });
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
        ),
      ]);
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      if (client) {
        client.disconnect();
      }
    }
  }
}
