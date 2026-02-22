import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../whatsapp.service';

const mockConfigValues: Record<string, string> = {
  'whatsapp.baseUrl': 'https://graph.facebook.com',
  'whatsapp.apiVersion': 'v21.0',
  'whatsapp.phoneNumberId': '123456789',
  'whatsapp.accessToken': 'test-token',
};

const mockConfigService = {
  get: (key: string) => mockConfigValues[key] ?? null,
};

describe('WhatsAppService', () => {
  let service: WhatsAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send text message with correct payload', async () => {
    const postSpy = vi
      .spyOn(service.client, 'post')
      .mockResolvedValue({ data: { messages: [{ id: 'msg_id' }] } });

    await service.sendTextMessage('5511999999999', 'Olá!');

    expect(postSpy).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'text',
      text: { body: 'Olá!' },
    });
  });

  it('should call markAsRead with correct message_id', async () => {
    const postSpy = vi
      .spyOn(service.client, 'post')
      .mockResolvedValue({ data: {} });

    await service.markAsRead('wamid.test123');

    expect(postSpy).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.test123',
    });
  });

  it('should send template message with correct structure', async () => {
    const postSpy = vi
      .spyOn(service.client, 'post')
      .mockResolvedValue({ data: {} });

    await service.sendTemplateMessage(
      '5511999999999',
      'boas_vindas',
      'pt_BR',
      [{ type: 'body', parameters: [] }],
    );

    expect(postSpy).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'template',
      template: {
        name: 'boas_vindas',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [] }],
      },
    });
  });

  it('should send template message without components when not provided', async () => {
    const postSpy = vi
      .spyOn(service.client, 'post')
      .mockResolvedValue({ data: {} });

    await service.sendTemplateMessage('5511999999999', 'hello_world', 'en_US');

    expect(postSpy).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' },
      },
    });
  });

  it('should send interactive message with correct payload', async () => {
    const postSpy = vi
      .spyOn(service.client, 'post')
      .mockResolvedValue({ data: {} });

    const interactive = {
      type: 'button',
      body: { text: 'Escolha uma opção' },
      action: { buttons: [] },
    };

    await service.sendInteractiveMessage('5511999999999', interactive);

    expect(postSpy).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'interactive',
      interactive,
    });
  });

  it('should not throw when sendTypingIndicator is called', async () => {
    await expect(
      service.sendTypingIndicator('5511999999999'),
    ).resolves.not.toThrow();
  });
});
