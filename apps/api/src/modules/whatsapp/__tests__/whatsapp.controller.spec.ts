import * as crypto from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException } from '@nestjs/common';
import { WhatsAppController } from '../whatsapp.controller';
import { WhatsAppService } from '../whatsapp.service';
import { WhatsAppDedupService } from '../whatsapp-dedup.service';
import { WHATSAPP_QUEUE_NAME } from '../constants/whatsapp.constants';
import type { WhatsAppWebhookPayload } from '../interfaces/whatsapp.types';
import type { FastifyRequest } from 'fastify';

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'test-verify-token';

function buildSignature(rawBody: Buffer): string {
  const hash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody)
    .digest('hex');
  return `sha256=${hash}`;
}

const validPayload: WhatsAppWebhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'entry-id',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001111',
              phone_number_id: 'phone-number-id',
            },
            contacts: [{ profile: { name: 'Test User' }, wa_id: '5511999999999' }],
            messages: [
              {
                id: 'wamid.test123',
                from: '5511999999999',
                timestamp: '1700000000',
                type: 'text',
                text: { body: 'Olá!' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let mockQueue: { add: ReturnType<typeof vi.fn> };
  let mockDedupService: { isNewMessage: ReturnType<typeof vi.fn> };
  let mockWhatsAppService: { sendTextMessage: ReturnType<typeof vi.fn> };

  const mockConfigService = {
    get: (key: string) => {
      const values: Record<string, string> = {
        'whatsapp.webhookVerifyToken': VERIFY_TOKEN,
        'whatsapp.appSecret': APP_SECRET,
      };
      return values[key] ?? null;
    },
  };

  beforeEach(async () => {
    mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job-id' }) };
    mockDedupService = { isNewMessage: vi.fn().mockResolvedValue(true) };
    mockWhatsAppService = { sendTextMessage: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppService, useValue: mockWhatsAppService },
        { provide: WhatsAppDedupService, useValue: mockDedupService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getQueueToken(WHATSAPP_QUEUE_NAME),
          useValue: mockQueue,
        },
      ],
    }).compile();

    controller = module.get<WhatsAppController>(WhatsAppController);
  });

  // ── GET /webhook ──────────────────────────────────────────────────────

  describe('verifyWebhook', () => {
    it('should return the challenge when token is correct', () => {
      const result = controller.verifyWebhook({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'challenge_value_123',
      });

      expect(result).toBe('challenge_value_123');
    });

    it('should throw ForbiddenException when token is wrong', () => {
      expect(() =>
        controller.verifyWebhook({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge_value_123',
        }),
      ).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when mode is not subscribe', () => {
      expect(() =>
        controller.verifyWebhook({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'challenge_value_123',
        }),
      ).toThrow(ForbiddenException);
    });
  });

  // ── POST /webhook ─────────────────────────────────────────────────────

  describe('receiveWebhook', () => {
    it('should return { status: ok } and enqueue one job for valid payload', async () => {
      const rawBody = Buffer.from(JSON.stringify(validPayload));
      const signature = buildSignature(rawBody);
      const req = { rawBody } as unknown as FastifyRequest;

      const result = await controller.receiveWebhook(
        signature,
        validPayload as never,
        req,
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-message',
        expect.objectContaining({ messageId: 'wamid.test123' }),
        expect.any(Object),
      );
    });

    it('should throw ForbiddenException when HMAC signature is invalid', async () => {
      const rawBody = Buffer.from(JSON.stringify(validPayload));
      const req = { rawBody } as unknown as FastifyRequest;

      await expect(
        controller.receiveWebhook(
          'sha256=invalidsignature',
          validPayload as never,
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not enqueue when message is duplicate', async () => {
      mockDedupService.isNewMessage.mockResolvedValue(false);

      const rawBody = Buffer.from(JSON.stringify(validPayload));
      const signature = buildSignature(rawBody);
      const req = { rawBody } as unknown as FastifyRequest;

      const result = await controller.receiveWebhook(
        signature,
        validPayload as never,
        req,
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should enqueue multiple jobs for multiple messages', async () => {
      const multiPayload: WhatsAppWebhookPayload = {
        ...validPayload,
        entry: [
          {
            id: 'entry-id',
            changes: [
              {
                field: 'messages',
                value: {
                  ...validPayload.entry[0].changes[0].value,
                  messages: [
                    { id: 'msg1', from: '5511111111111', timestamp: '1', type: 'text', text: { body: 'A' } },
                    { id: 'msg2', from: '5522222222222', timestamp: '2', type: 'text', text: { body: 'B' } },
                    { id: 'msg3', from: '5533333333333', timestamp: '3', type: 'text', text: { body: 'C' } },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(multiPayload));
      const signature = buildSignature(rawBody);
      const req = { rawBody } as unknown as FastifyRequest;

      await controller.receiveWebhook(signature, multiPayload as never, req);

      expect(mockQueue.add).toHaveBeenCalledTimes(3);
    });

    it('should not enqueue when payload has only statuses (no messages)', async () => {
      const statusPayload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-id',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550001111',
                    phone_number_id: 'phone-number-id',
                  },
                  statuses: [
                    {
                      id: 'msg1',
                      status: 'read',
                      timestamp: '1700000000',
                      recipient_id: '5511999999999',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = Buffer.from(JSON.stringify(statusPayload));
      const signature = buildSignature(rawBody);
      const req = { rawBody } as unknown as FastifyRequest;

      const result = await controller.receiveWebhook(
        signature,
        statusPayload as never,
        req,
      );

      expect(result).toEqual({ status: 'ok' });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should skip HMAC validation when rawBody is unavailable', async () => {
      const req = {} as unknown as FastifyRequest;

      const result = await controller.receiveWebhook(
        'sha256=anysignature',
        validPayload as never,
        req,
      );

      expect(result).toEqual({ status: 'ok' });
    });
  });
});
