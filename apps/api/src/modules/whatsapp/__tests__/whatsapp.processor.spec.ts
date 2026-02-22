import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppProcessor } from '../whatsapp.processor';
import { WhatsAppService } from '../whatsapp.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { WhatsAppMessageJob } from '../interfaces/whatsapp.types';
import type { Job } from 'bullmq';
import { WHATSAPP_JOB_ATTEMPTS } from '../constants/whatsapp.constants';

const buildJob = (
  overrides: Partial<WhatsAppMessageJob> = {},
  attemptsMade = 1,
): Job<WhatsAppMessageJob> =>
  ({
    id: 'job-id',
    attemptsMade,
    data: {
      messageId: 'wamid.test123',
      from: '5511999999999',
      message: {
        id: 'wamid.test123',
        from: '5511999999999',
        timestamp: '1700000000',
        type: 'text',
        text: { body: 'Olá!' },
      },
      contact: { profile: { name: 'Test User' }, wa_id: '5511999999999' },
      phoneNumberId: 'phone-number-id',
      receivedAt: new Date().toISOString(),
      ...overrides,
    },
  }) as unknown as Job<WhatsAppMessageJob>;

describe('WhatsAppProcessor', () => {
  let processor: WhatsAppProcessor;
  let mockWhatsAppService: {
    sendTypingIndicator: ReturnType<typeof vi.fn>;
    sendTextMessage: ReturnType<typeof vi.fn>;
    markAsRead: ReturnType<typeof vi.fn>;
  };
  let mockPrisma: {
    user: { upsert: ReturnType<typeof vi.fn> };
  };

  const fakeUser = { id: 'user-id', phone: '+5511999999999', name: 'Test User' };

  beforeEach(async () => {
    mockWhatsAppService = {
      sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
      sendTextMessage: vi.fn().mockResolvedValue(undefined),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      user: {
        upsert: vi.fn().mockResolvedValue(fakeUser),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProcessor,
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<WhatsAppProcessor>(WhatsAppProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should call sendTypingIndicator, sendTextMessage and markAsRead when processing a job', async () => {
    const job = buildJob();

    await processor.process(job);

    expect(mockWhatsAppService.sendTypingIndicator).toHaveBeenCalledWith(
      '5511999999999',
    );
    expect(mockWhatsAppService.sendTextMessage).toHaveBeenCalledWith(
      '5511999999999',
      'Recebido! Em breve vou te ajudar. 🛒',
    );
    expect(mockWhatsAppService.markAsRead).toHaveBeenCalledWith('wamid.test123');
  });

  it('should upsert user by phone number (E.164 format)', async () => {
    const job = buildJob();

    await processor.process(job);

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: '+5511999999999' },
        create: expect.objectContaining({ phone: '+5511999999999' }),
      }),
    );
  });

  it('should use contact name when creating user', async () => {
    const job = buildJob();

    await processor.process(job);

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: 'Test User' }),
      }),
    );
  });

  it('should use phone number as name when contact has no profile name', async () => {
    const job = buildJob({ contact: undefined });

    await processor.process(job);

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: '+5511999999999' }),
      }),
    );
  });

  it('should log DLQ when attemptsMade >= max attempts', () => {
    const loggerErrorSpy = vi
      .spyOn(processor['logger'], 'error')
      .mockImplementation(() => undefined);

    const job = buildJob({}, WHATSAPP_JOB_ATTEMPTS);
    const error = new Error('Processing failed');

    processor.onFailed(job, error);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('DLQ'),
    );
  });

  it('should not log DLQ when attemptsMade < max attempts', () => {
    const loggerErrorSpy = vi
      .spyOn(processor['logger'], 'error')
      .mockImplementation(() => undefined);

    const job = buildJob({}, 1);
    const error = new Error('First failure');

    processor.onFailed(job, error);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('DLQ'),
    );
  });
});
