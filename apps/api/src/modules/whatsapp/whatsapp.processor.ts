import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { GeminiService } from '../gemini/gemini.service';
import { WhatsAppMessageJob } from './interfaces/whatsapp.types';
import {
  WHATSAPP_JOB_ATTEMPTS,
  WHATSAPP_QUEUE_NAME,
} from './constants/whatsapp.constants';

@Processor(WHATSAPP_QUEUE_NAME, { concurrency: 5 })
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {
    super();
  }

  async process(job: Job<WhatsAppMessageJob>): Promise<void> {
    const { messageId, from, message, contact, receivedAt } = job.data;

    this.logger.log(`Processing message ${messageId} from ${from}`);

    const phoneE164 = `+${from}`;

    const user = await this.prisma.user.upsert({
      where: { phone: phoneE164 },
      create: {
        phone: phoneE164,
        name: contact?.profile?.name ?? phoneE164,
      },
      update: {},
    });

    await this.whatsappService.sendTypingIndicator(from);

    const userText =
      message.type === 'text'
        ? (message.text?.body ?? '')
        : '[mídia recebida]';

    const responseText = await this.geminiService.chat(user.id, userText, {
      userName: user.name ?? undefined,
    });

    await this.whatsappService.sendTextMessage(from, responseText);
    await this.whatsappService.markAsRead(messageId);

    this.logger.log(
      `Message ${messageId} processed for user ${user.id} (${phoneE164}). ` +
        `Type: ${message.type}. Received: ${receivedAt}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WhatsAppMessageJob>, error: Error): void {
    this.logger.error(
      `Job ${job.id} (message ${job.data.messageId}) failed after ${job.attemptsMade} attempts: ${error.message}`,
      error.stack,
    );

    if (job.attemptsMade >= WHATSAPP_JOB_ATTEMPTS) {
      this.logger.error(
        `Message ${job.data.messageId} sent to DLQ after ${job.attemptsMade} failed attempts`,
      );
      // TODO TAREFA-007: Sentry.captureException(error, { extra: { jobId: job.id, messageId: job.data.messageId } })
    }
  }
}
