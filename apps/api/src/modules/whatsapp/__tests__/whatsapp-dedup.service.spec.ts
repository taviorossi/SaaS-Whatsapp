import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppDedupService, REDIS_CLIENT } from '../whatsapp-dedup.service';
import {
  WHATSAPP_DEDUP_KEY_PREFIX,
  WHATSAPP_DEDUP_TTL_SECONDS,
} from '../constants/whatsapp.constants';

describe('WhatsAppDedupService', () => {
  let service: WhatsAppDedupService;
  let mockRedis: { set: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockRedis = {
      set: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppDedupService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<WhatsAppDedupService>(WhatsAppDedupService);
  });

  it('should return true for a new message', async () => {
    mockRedis.set.mockResolvedValue('OK');

    const result = await service.isNewMessage('wamid.new123');

    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      `${WHATSAPP_DEDUP_KEY_PREFIX}wamid.new123`,
      '1',
      'EX',
      WHATSAPP_DEDUP_TTL_SECONDS,
      'NX',
    );
  });

  it('should return false for a duplicate message', async () => {
    mockRedis.set.mockResolvedValue(null);

    const result = await service.isNewMessage('wamid.duplicate456');

    expect(result).toBe(false);
  });

  it('should apply correct TTL (24h = 86400 seconds)', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await service.isNewMessage('wamid.ttl789');

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.any(String),
      '1',
      'EX',
      86400,
      'NX',
    );
  });

  it('should use correct key prefix', async () => {
    mockRedis.set.mockResolvedValue('OK');

    await service.isNewMessage('abc123');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'wa:dedup:abc123',
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.any(String),
    );
  });
});
