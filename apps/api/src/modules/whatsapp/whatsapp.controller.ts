import * as crypto from 'crypto';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppDedupService } from './whatsapp-dedup.service';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import {
  WhatsAppMessageJob,
  WhatsAppWebhookPayload,
} from './interfaces/whatsapp.types';
import {
  WHATSAPP_JOB_ATTEMPTS,
  WHATSAPP_QUEUE_NAME,
} from './constants/whatsapp.constants';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    @InjectQueue(WHATSAPP_QUEUE_NAME) private readonly messagesQueue: Queue,
    private readonly dedupService: WhatsAppDedupService,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /api/v1/whatsapp/webhook
   * Verificação do webhook pela Meta (challenge handshake).
   */
  @Public()
  @Get('webhook')
  verifyWebhook(@Query() query: Record<string, string>): string {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const verifyToken = this.config.get<string>('whatsapp.webhookVerifyToken');

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge ?? '';
    }

    throw new ForbiddenException('Webhook verification failed');
  }

  /**
   * POST /api/v1/whatsapp/webhook
   * Recebe eventos da Meta: valida HMAC, deduplica e enfileira mensagens.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: WebhookPayloadDto,
    @Req() req: FastifyRequest,
  ): Promise<{ status: string }> {
    const rawBody = (req as FastifyRequest & { rawBody?: Buffer }).rawBody;

    if (rawBody) {
      const valid = this.validateSignature(rawBody, signature);
      if (!valid) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    } else {
      this.logger.warn('rawBody not available — HMAC validation skipped');
    }

    const payload = body as unknown as WhatsAppWebhookPayload;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          const isNew = await this.dedupService.isNewMessage(message.id);

          if (!isNew) {
            this.logger.warn(`Duplicate message skipped: ${message.id}`);
            continue;
          }

          const jobPayload: WhatsAppMessageJob = {
            messageId: message.id,
            from: message.from,
            message,
            contact: change.value.contacts?.[0],
            phoneNumberId: change.value.metadata.phone_number_id,
            receivedAt: new Date().toISOString(),
          };

          await this.messagesQueue.add('process-message', jobPayload, {
            attempts: WHATSAPP_JOB_ATTEMPTS,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: false,
          });

          this.logger.log(
            `Message enqueued: ${message.id} from ${message.from}`,
          );
        }
      }
    }

    return { status: 'ok' };
  }

  private validateSignature(rawBody: Buffer, signature: string): boolean {
    const appSecret = this.config.get<string>('whatsapp.appSecret');
    if (!appSecret || !signature) return false;

    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(`sha256=${expected}`, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
