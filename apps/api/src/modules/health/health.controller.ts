import {
  Controller,
  Get,
  OnModuleDestroy,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

export type HealthStatus = 'ok' | 'degraded' | 'error';
export type CheckStatus = 'up' | 'down' | 'disabled';

export interface HealthChecks {
  database: CheckStatus;
  redis: CheckStatus;
}

export interface HealthResponse {
  status: HealthStatus;
  checks: HealthChecks;
}

@ApiTags('Health')
@Controller('health')
export class HealthController implements OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('redis.url');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
    }
  }

  onModuleDestroy(): void {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  @Get()
  @ApiOperation({ summary: 'Health check (DB and Redis)' })
  @ApiResponse({ status: 200, description: 'Health status and checks' })
  async getHealth(): Promise<HealthResponse> {
    const dbStatus = await this.checkDatabase();
    const redisStatus = await this.checkRedis();

    const status: HealthStatus =
      dbStatus === 'down'
        ? 'error'
        : redisStatus === 'down'
          ? 'degraded'
          : 'ok';

    return {
      status,
      checks: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }

  private async checkDatabase(): Promise<CheckStatus> {
    const timeoutMs = 2000;
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckStatus> {
    if (!this.redis) {
      return 'disabled';
    }
    const timeoutMs = 2000;
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return 'up';
    } catch {
      return 'down';
    }
  }
}
