import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppDedupService } from './whatsapp-dedup.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';
import { WHATSAPP_QUEUE_NAME } from './constants/whatsapp.constants';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    GeminiModule,
    BullModule.registerQueue({
      name: WHATSAPP_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsAppProcessor, WhatsAppDedupService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
