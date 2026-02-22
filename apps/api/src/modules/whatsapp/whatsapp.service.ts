import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  readonly client: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    const baseUrl = this.config.get<string>('whatsapp.baseUrl') ?? 'https://graph.facebook.com';
    const apiVersion = this.config.get<string>('whatsapp.apiVersion') ?? 'v21.0';
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId') ?? '';
    const accessToken = this.config.get<string>('whatsapp.accessToken') ?? '';

    this.client = axios.create({
      baseURL: `${baseUrl}/${apiVersion}/${phoneNumberId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: (retryCount) => ([0, 1000, 5000][retryCount] ?? 5000),
      retryCondition: (error) =>
        error.response?.status === 429 ||
        (error.response?.status ?? 0) >= 500,
      onRetry: (retryCount, error) => {
        this.logger.warn(`WhatsApp API retry ${retryCount}: ${error.message}`);
      },
    });
  }

  /**
   * Envia uma mensagem de texto simples.
   */
  async sendTextMessage(to: string, text: string): Promise<void> {
    await this.client.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    });
  }

  /**
   * Envia uma mensagem de template (HSM).
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: Record<string, unknown>[],
  ): Promise<void> {
    await this.client.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components ? { components } : {}),
      },
    });
  }

  /**
   * Envia uma mensagem interativa (botões / lista).
   */
  async sendInteractiveMessage(
    to: string,
    interactive: Record<string, unknown>,
  ): Promise<void> {
    await this.client.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive,
    });
  }

  /**
   * Proxy para "typing indicator": a Meta Cloud API não tem endpoint nativo de
   * digitando; marcar a mensagem como lida (read) dispara o indicador de "visto"
   * no cliente WhatsApp, que é o comportamento mais próximo disponível.
   */
  async sendTypingIndicator(to: string): Promise<void> {
    // A Meta não expõe typing indicator para Cloud API.
    // markAsRead é chamado pelo caller com o messageId real — este método
    // é mantido por semântica no processador.
    this.logger.debug(`Typing indicator (read proxy) for ${to}`);
  }

  /**
   * Marca uma mensagem recebida como lida, ativando o "visto" (dois checks azuis).
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }
}
