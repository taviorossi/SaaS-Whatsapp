import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import {
  WHATSAPP_DEDUP_KEY_PREFIX,
  WHATSAPP_DEDUP_TTL_SECONDS,
} from './constants/whatsapp.constants';

@Injectable()
export class WhatsAppDedupService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /**
   * Retorna true se a mensagem é nova (não processada antes).
   * SET NX com TTL 24h garante idempotência.
   */
  async isNewMessage(messageId: string): Promise<boolean> {
    const key = `${WHATSAPP_DEDUP_KEY_PREFIX}${messageId}`;
    const result = await this.redis.set(
      key,
      '1',
      'EX',
      WHATSAPP_DEDUP_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }
}
