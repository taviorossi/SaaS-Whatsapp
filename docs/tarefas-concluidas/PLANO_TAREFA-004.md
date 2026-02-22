# PLANO DE IMPLEMENTAÇÃO — TAREFA-004: Integração WhatsApp Business API

**Tarefa:** TAREFA-004-INTEGRACAO-WHATSAPP  
**Data:** 20/02/2026  
**Estimativa Total:** ~14 horas  
**Padrão Arquitetural:** Queue-First (webhook → BullMQ → worker → resposta)  
**Referências:** ADR-004, ARCHITECTURE.md §5 e §8

---

## Visão Geral do Fluxo

```
Meta Cloud API
     │  POST /whatsapp/webhook
     ▼
WhatsApp Controller
  1. Valida X-Hub-Signature-256 (HMAC-SHA256, constant-time)
  2. Itera entry[].changes[].value.messages[]
  3. Deduplicação por message_id (Redis SET NX, TTL 24h)
  4. Enfileira job no BullMQ (queue: "messages")
  5. Retorna HTTP 200 imediatamente
     │
     ▼ (async)
WhatsApp Processor (BullMQ Worker)
  1. Parse do payload do job
  2. Busca/cria usuário no DB (PrismaService, pelo phone number)
  3. Envia typing indicator (sendTypingIndicator)
  4. [Placeholder TAREFA-005] Responde "Recebido! Em breve vou te ajudar."
  5. Marca mensagem como lida (markAsRead)
  6. Loga entrada e saída
  7. Em caso de falha: retry (3x, backoff 1s/5s/25s) → DLQ
```

---

## Etapa 1 — Dependências e Configuração (~1h)

### 1.1 Instalar pacotes novos

```bash
# Na raiz do monorepo (pnpm workspace)
pnpm --filter api add @nestjs/bullmq bullmq axios axios-retry
```

> **Nota sobre SDK da Meta:** O pacote npm `whatsapp` (SDK oficial da Meta) ainda não é maduro o suficiente para produção (falta tipagem adequada, atualização irregular). Usar `axios` diretamente conforme ADR-004.

> **ioredis** já está instalado (`^5.4.1`). Não reinstalar.

### 1.2 Atualizar variáveis de ambiente

**Arquivo:** `apps/api/src/config/validation.ts`

Adicionar ao `envSchema` (após `API_URL`):

```typescript
// WhatsApp / Meta Cloud API
WA_PHONE_NUMBER_ID: z.string().min(1).optional(),       // obrigatório em prod
WA_ACCESS_TOKEN: z.string().min(1).optional(),           // obrigatório em prod
WA_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),   // obrigatório em prod
WA_APP_SECRET: z.string().min(1).optional(),             // obrigatório em prod (HMAC)
WA_API_VERSION: z.string().default('v21.0'),
```

Adicionar `.env.example` (raiz do monorepo):

```
# WhatsApp Business (Meta Cloud API)
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WEBHOOK_VERIFY_TOKEN=
WA_APP_SECRET=
WA_API_VERSION=v21.0
```

### 1.3 Criar `src/config/whatsapp.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('whatsapp', () => ({
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  accessToken: process.env.WA_ACCESS_TOKEN,
  webhookVerifyToken: process.env.WA_WEBHOOK_VERIFY_TOKEN,
  appSecret: process.env.WA_APP_SECRET,
  apiVersion: process.env.WA_API_VERSION ?? 'v21.0',
  baseUrl: 'https://graph.facebook.com',
}));
```

### 1.4 Registrar `whatsappConfig` em `src/config/index.ts`

```typescript
import whatsappConfig from './whatsapp.config';

export const configLoaders = [appConfig, databaseConfig, redisConfig, authConfig, whatsappConfig];
```

### 1.5 Configurar `BullMQModule.forRootAsync` no `AppModule`

Em `src/app.module.ts`, adicionar import:

```typescript
import { BullModule } from '@nestjs/bullmq';

// Dentro de @Module({ imports: [...] })
BullModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    connection: {
      url: config.get<string>('redis.url'),
    },
  }),
  inject: [ConfigService],
}),
```

---

## Etapa 2 — Tipos e Interfaces (~30min)

**Arquivo:** `src/modules/whatsapp/interfaces/whatsapp.types.ts`

Definir os seguintes tipos que espelham a estrutura do payload de webhook da Meta:

```typescript
export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'order'
  | 'system'
  | 'unknown';

export interface WhatsAppTextBody {
  body: string;
}

export interface WhatsAppMediaBody {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppInteractiveReply {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: WhatsAppTextBody;
  image?: WhatsAppMediaBody;
  audio?: WhatsAppMediaBody;
  video?: WhatsAppMediaBody;
  document?: WhatsAppMediaBody;
  interactive?: WhatsAppInteractiveReply;
  referral?: Record<string, unknown>;
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

export interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: Array<{ code: number; title: string; message: string }>;
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: string;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

// Job payload enfileirado no BullMQ
export interface WhatsAppMessageJob {
  messageId: string;
  from: string;
  message: WhatsAppMessage;
  contact?: WhatsAppContact;
  phoneNumberId: string;
  receivedAt: string;
}
```

---

## Etapa 3 — Constantes (~15min)

**Arquivo:** `src/modules/whatsapp/constants/whatsapp.constants.ts`

```typescript
export const WHATSAPP_QUEUE_NAME = 'messages';
export const WHATSAPP_DLQ_NAME = 'messages-dlq';
export const WHATSAPP_API_VERSION = 'v21.0';
export const WHATSAPP_BASE_URL = 'https://graph.facebook.com';
export const WHATSAPP_DEDUP_TTL_SECONDS = 86400; // 24h
export const WHATSAPP_DEDUP_KEY_PREFIX = 'wa:dedup:';

// Retry policy (conforme ADR-004)
export const WHATSAPP_JOB_ATTEMPTS = 3;
export const WHATSAPP_JOB_BACKOFF_DELAYS = [1000, 5000, 25000]; // ms
```

---

## Etapa 4 — DTOs (~30min)

### 4.1 Webhook Payload DTO

**Arquivo:** `src/modules/whatsapp/dto/webhook-payload.dto.ts`

```typescript
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// DTOs espelham WhatsAppWebhookPayload para validação via class-validator
// Usar validação permissiva (IsObject, IsOptional) pois a Meta pode adicionar campos.
export class WebhookPayloadDto {
  @IsString()
  object: string;

  @IsArray()
  entry: unknown[];
}
```

> **Nota:** Validação profunda do payload é feita via tipagem TypeScript interna (casting para `WhatsAppWebhookPayload`), não via class-validator, pois a estrutura é muito aninhada e a Meta pode variar campos. O DTO garante apenas que `object` e `entry` existem.

### 4.2 Send Message DTO

**Arquivo:** `src/modules/whatsapp/dto/send-message.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}

export class SendTemplateMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsString()
  @IsNotEmpty()
  languageCode: string;

  @IsOptional()
  @IsObject()
  components?: Record<string, unknown>[];
}

export class SendInteractiveMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @IsObject()
  interactive: Record<string, unknown>;
}
```

---

## Etapa 5 — WhatsApp Service (envio) (~2h)

**Arquivo:** `src/modules/whatsapp/whatsapp.service.ts`

### Responsabilidades
- Encapsular chamadas à Meta Graph API (`/{version}/{phone_number_id}/messages`)
- Retry automático em 429/5xx via `axios-retry`
- Fornecer `sendTextMessage`, `sendTemplateMessage`, `sendInteractiveMessage`, `sendTypingIndicator`, `markAsRead`

### Estrutura do serviço

```typescript
@Injectable()
export class WhatsAppService {
  private readonly client: AxiosInstance;
  private readonly apiVersion: string;
  private readonly phoneNumberId: string;
  private readonly baseMessagesUrl: string;

  constructor(private readonly config: ConfigService) {
    // Configurar axios com retry (axios-retry: 3 tentativas, 429/5xx)
    // Bearer token no header padrão
    // baseURL: https://graph.facebook.com/{version}/{phone_number_id}
  }

  async sendTextMessage(to: string, text: string): Promise<void>
  // POST /messages { messaging_product, to, type: 'text', text: { body } }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: Record<string, unknown>[],
  ): Promise<void>
  // POST /messages { messaging_product, to, type: 'template', template: { name, language, components } }

  async sendInteractiveMessage(to: string, interactive: Record<string, unknown>): Promise<void>
  // POST /messages { messaging_product, to, type: 'interactive', interactive }

  async sendTypingIndicator(to: string): Promise<void>
  // POST /messages { messaging_product, to, recipient_type: 'individual', type: 'reaction',
  //   reaction: { message_id: '', emoji: '' } }
  // NOTA: A Meta não tem endpoint nativo de "typing"; usar status 'read' como proxy
  // Implementação real: marcar como lida dispara "visto" no WhatsApp, que é o comportamento mais próximo.

  async markAsRead(messageId: string): Promise<void>
  // POST /messages { messaging_product: 'whatsapp', status: 'read', message_id: messageId }
}
```

### Detalhes de implementação

```typescript
// Configuração do axios-retry
axiosRetry(this.client, {
  retries: 3,
  retryDelay: (retryCount) => [0, 1000, 5000][retryCount] ?? 5000,
  retryCondition: (error) =>
    error.response?.status === 429 ||
    (error.response?.status ?? 0) >= 500,
  onRetry: (retryCount, error) => {
    this.logger.warn(`WhatsApp API retry ${retryCount}: ${error.message}`);
  },
});
```

---

## Etapa 6 — WhatsApp Controller (webhook) (~2h)

**Arquivo:** `src/modules/whatsapp/whatsapp.controller.ts`

### Ponto crítico: rota fora do prefixo `api/v1`

O `main.ts` aplica `app.setGlobalPrefix('api/v1')` **globalmente**. A Meta registra o webhook em uma URL fixa. Há duas opções:

**Opção A (Recomendada):** Usar `@Controller({ path: 'whatsapp/webhook', version: false })` com o decorator `@Version('none')` do NestJS. **Problema:** requer habilitar versionamento em `main.ts`.

**Opção B (Mais simples):** Registrar a rota do webhook **com** o prefixo padrão → URL final: `POST /api/v1/whatsapp/webhook`. Registrar esta URL no Meta Developer Console. Esta é a abordagem adotada neste plano por ser mais simples e compatível com a infra atual.

> **Ação em produção:** Configurar no Meta Developer Console:  
> `Callback URL: https://api.comprazap.com/api/v1/whatsapp/webhook`

### Decorator de rota pública

Criar `src/common/decorators/public.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Atualizar `JwtAuthGuard.canActivate` para verificar o metadata `IS_PUBLIC_KEY` via `Reflector` e retornar `true` imediatamente se a rota for pública.

### Estrutura do controller

```typescript
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    @InjectQueue(WHATSAPP_QUEUE_NAME) private readonly messagesQueue: Queue,
    private readonly redis: Redis, // IORedis injetado via token
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  // GET /api/v1/whatsapp/webhook — verificação do webhook pela Meta
  @Public()
  @Get('webhook')
  verifyWebhook(@Query() query: Record<string, string>, @Res() res: FastifyReply): void {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const verifyToken = this.config.get<string>('whatsapp.webhookVerifyToken');

    if (mode === 'subscribe' && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  // POST /api/v1/whatsapp/webhook — receber mensagens da Meta
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async receiveWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: WebhookPayloadDto,
    @RawBody() rawBody: Buffer, // necessário para HMAC
  ): Promise<{ status: string }> {
    // 1. Validar HMAC
    // 2. Iterar entry[].changes[].value.messages[]
    // 3. Deduplicar e enfileirar cada mensagem
    return { status: 'ok' };
  }
}
```

### Validação HMAC (constant-time)

```typescript
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
```

### Acesso ao `rawBody` no Fastify

O Fastify do NestJS processa o body por padrão. Para acessar o `rawBody` (necessário para HMAC), adicionar em `main.ts`:

```typescript
// Antes de app.listen()
app.addHook('preHandler', async (req) => {
  if (req.url.includes('/whatsapp/webhook') && req.method === 'POST') {
    (req as any).rawBody = req.rawBody;
  }
});
```

Alternativa mais limpa: usar um `@RawBodyRequest()` decorator customizado ou configurar `addContentTypeParser` no Fastify para reter o raw body. Detalhes no arquivo de implementação.

### Loop de enfileiramento

```typescript
const payload = body as unknown as WhatsAppWebhookPayload;

for (const entry of payload.entry ?? []) {
  for (const change of entry.changes ?? []) {
    for (const message of change.value.messages ?? []) {
      // Deduplicação
      const dedupKey = `${WHATSAPP_DEDUP_KEY_PREFIX}${message.id}`;
      const isNew = await this.redis.set(dedupKey, '1', 'EX', WHATSAPP_DEDUP_TTL_SECONDS, 'NX');
      if (!isNew) {
        this.logger.warn(`Duplicate message skipped: ${message.id}`);
        continue;
      }

      // Enfileirar
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
        backoff: {
          type: 'custom',
          // delays: 1s, 5s, 25s (ADR-004)
        },
        removeOnComplete: 100,
        removeOnFail: false, // manter na DLQ para análise
      });

      this.logger.log(`Message enqueued: ${message.id} from ${message.from}`);
    }
  }
}
```

---

## Etapa 7 — WhatsApp Processor (worker BullMQ) (~2h)

**Arquivo:** `src/modules/whatsapp/whatsapp.processor.ts`

```typescript
@Processor(WHATSAPP_QUEUE_NAME, {
  concurrency: 5,
})
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<WhatsAppMessageJob>): Promise<void> {
    const { messageId, from, message, contact, receivedAt } = job.data;

    this.logger.log(`Processing message ${messageId} from ${from}`);

    // 1. Buscar ou criar usuário pelo phone number
    const phoneE164 = `+${from}`;
    const user = await this.prisma.user.upsert({
      where: { phone: phoneE164 },
      create: {
        phone: phoneE164,
        name: contact?.profile?.name ?? phoneE164,
      },
      update: {},
    });

    // 2. Indicador "digitando..."
    await this.whatsappService.sendTypingIndicator(from);

    // 3. [Placeholder — TAREFA-005 integrará Gemini]
    const responseText = 'Recebido! Em breve vou te ajudar. 🛒';
    await this.whatsappService.sendTextMessage(from, responseText);

    // 4. Marcar como lida
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
```

### Backoff customizado (1s, 5s, 25s)

Registrar o backoff customizado no `BullModule.registerQueue`:

```typescript
BullModule.registerQueue({
  name: WHATSAPP_QUEUE_NAME,
  defaultJobOptions: {
    attempts: WHATSAPP_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 5s (1*5^1), 25s (1*5^2) — aproximação via exponential com base 5
    },
    removeOnComplete: 100,
    removeOnFail: false,
  },
}),
```

> **Nota:** BullMQ suporta backoff `exponential` (base 2) nativamente. Para 1s/5s/25s exatos, usar `custom` backoff registrando uma função `backoffStrategy` no worker, ou usar os valores `[1000, 5000, 25000]` via estratégia customizada.

---

## Etapa 8 — Deduplicação via Redis (~30min)

A deduplicação está implementada inline no controller (Etapa 6), mas deve ser extraída para um serviço dedicado para facilitar testes:

**Arquivo:** `src/modules/whatsapp/whatsapp-dedup.service.ts`

```typescript
@Injectable()
export class WhatsAppDedupService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Retorna true se a mensagem é nova (não processada antes).
   * SET NX com TTL 24h garante idempotência.
   */
  async isNewMessage(messageId: string): Promise<boolean> {
    const key = `${WHATSAPP_DEDUP_KEY_PREFIX}${messageId}`;
    const result = await this.redis.set(key, '1', 'EX', WHATSAPP_DEDUP_TTL_SECONDS, 'NX');
    return result === 'OK';
  }
}
```

> **Alternativa via DB:** Se Redis não estiver disponível em dev, usar tabela `WebhookEvent` no Prisma com `messageId` como unique key e `processedAt`. O plano adota Redis como primário (mais rápido, sem lock de DB).

---

## Etapa 9 — Injeção do Redis no Módulo

Para injetar `ioredis` diretamente nos serviços, criar um provider de token:

**Arquivo:** `src/modules/whatsapp/whatsapp.module.ts` (seção de providers)

```typescript
import { createClient } from 'ioredis'; // ou reusar conexão global

const REDIS_CLIENT = 'REDIS_CLIENT';

const redisProvider: FactoryProvider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    const url = config.get<string>('redis.url');
    return url ? new Redis(url) : new Redis(); // fallback para localhost
  },
  inject: [ConfigService],
};
```

> **Alternativa:** Usar `@nestjs-modules/ioredis` ou criar `RedisModule` global. Para este MVP, instanciar diretamente no `WhatsAppModule`.

---

## Etapa 10 — WhatsApp Module (~30min)

**Arquivo:** `src/modules/whatsapp/whatsapp.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppDedupService } from './whatsapp-dedup.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WHATSAPP_QUEUE_NAME } from './constants/whatsapp.constants';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
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
  providers: [
    WhatsAppService,
    WhatsAppProcessor,
    WhatsAppDedupService,
    redisProvider, // provider de IORedis para deduplicação
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

---

## Etapa 11 — Registrar no AppModule (~15min)

**Arquivo:** `src/app.module.ts`

Adicionar:

```typescript
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('redis.url') },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    WhatsAppModule,   // ← novo
  ],
  ...
})
export class AppModule {}
```

---

## Etapa 12 — Atualizar `JwtAuthGuard` para suportar rotas públicas (~30min)

**Arquivo:** `src/common/guards/jwt-auth.guard.ts`

Injetar `Reflector` e verificar metadata `IS_PUBLIC_KEY`:

```typescript
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ... resto da lógica JWT existente
  }
}
```

> **Atenção:** O `JwtAuthGuard` atual só é aplicado via `@UseGuards(JwtAuthGuard)` por controller — não é global. O decorator `@Public()` é uma precaução para quando um guard global for adicionado futuramente. Para o webhook, simplesmente **não aplicar** `@UseGuards(JwtAuthGuard)` no `WhatsAppController` é suficiente.

---

## Etapa 13 — Configurar rawBody no Fastify (~30min)

**Arquivo:** `src/main.ts`

O Fastify precisa expor o body bruto para validação HMAC. Adicionar `addContentTypeParser` antes de `app.listen`:

```typescript
// Preservar raw body para validação HMAC no webhook do WhatsApp
import { FastifyInstance } from 'fastify';

const fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;
fastifyInstance.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (req, body: Buffer, done) => {
    try {
      const parsed = JSON.parse(body.toString('utf8')) as unknown;
      (req as any).rawBody = body;
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);
```

> **Nota:** Esta configuração sobrescreve o parser padrão do Fastify para todas as rotas JSON. Alternativa mais granular: usar um middleware específico para `/api/v1/whatsapp/webhook`.

---

## Etapa 14 — Testes (~3h)

### 14.1 `whatsapp.service.spec.ts`

**Localização:** `src/modules/whatsapp/whatsapp.service.spec.ts`

Casos de teste:
- `sendTextMessage`: mock do axios; verificar POST para URL correta com payload correto
- `sendTextMessage`: simular resposta 429 → verificar que axios-retry tenta novamente
- `sendTypingIndicator`: verificar payload com `status: 'read'`
- `markAsRead`: verificar payload com `message_id` correto
- `sendTemplateMessage`: verificar estrutura `template.name` e `template.language`

```typescript
describe('WhatsAppService', () => {
  let service: WhatsAppService;
  let axiosPost: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get(WhatsAppService);
    axiosPost = vi.spyOn(service['client'], 'post').mockResolvedValue({ data: {} });
  });

  it('should send text message with correct payload', async () => {
    await service.sendTextMessage('5511999999999', 'Olá!');
    expect(axiosPost).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      to: '5511999999999',
      type: 'text',
      text: { body: 'Olá!' },
    });
  });
  // ... outros casos
});
```

### 14.2 `whatsapp.controller.spec.ts`

**Localização:** `src/modules/whatsapp/whatsapp.controller.spec.ts`

Casos de teste:
- `GET /webhook` com token correto → retorna 200 com challenge
- `GET /webhook` com token errado → retorna 403
- `POST /webhook` com assinatura HMAC válida → retorna `{ status: 'ok' }` e enfileira job
- `POST /webhook` com assinatura HMAC inválida → retorna 401/403
- `POST /webhook` com mensagem duplicada (messageId já no Redis) → enfileira 0 jobs
- `POST /webhook` com `entry[].changes[].value.messages[]` com 3 mensagens → enfileira 3 jobs
- `POST /webhook` sem mensagens (apenas `statuses`) → não enfileira nada

```typescript
describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let mockQueue: { add: jest.Mock };
  let mockDedupService: { isNewMessage: jest.Mock };

  // Usar fixture de payload realista da Meta
  const validPayload: WhatsAppWebhookPayload = { ... };

  it('should enqueue one job per new message', async () => {
    mockDedupService.isNewMessage.mockResolvedValue(true);
    await controller.receiveWebhook(validSignature, validPayload, rawBody);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    expect(mockQueue.add).toHaveBeenCalledWith('process-message', expect.objectContaining({
      messageId: 'wamid.test123',
    }), expect.any(Object));
  });
});
```

### 14.3 `whatsapp.processor.spec.ts`

**Localização:** `src/modules/whatsapp/whatsapp.processor.spec.ts`

Casos de teste:
- Processar job de texto → chama `sendTypingIndicator`, `sendTextMessage`, `markAsRead`
- Processar job de usuário novo → cria usuário via `prisma.user.upsert`
- Processar job de usuário existente → não duplica usuário
- `onFailed` com 3 tentativas → loga mensagem de DLQ

### 14.4 `whatsapp-dedup.service.spec.ts`

- `isNewMessage` com messageId novo → retorna `true`
- `isNewMessage` com messageId repetido → retorna `false`
- Verificar que TTL é aplicado (24h)

---

## Estrutura de Arquivos Final

```
apps/api/src/
├── config/
│   ├── index.ts                          [ATUALIZAR — adicionar whatsappConfig]
│   ├── validation.ts                     [ATUALIZAR — adicionar vars WA_*]
│   └── whatsapp.config.ts                [CRIAR]
│
├── common/
│   └── decorators/
│       └── public.decorator.ts           [CRIAR]
│
├── modules/
│   └── whatsapp/
│       ├── whatsapp.module.ts            [CRIAR]
│       ├── whatsapp.controller.ts        [CRIAR]
│       ├── whatsapp.service.ts           [CRIAR]
│       ├── whatsapp.processor.ts         [CRIAR]
│       ├── whatsapp-dedup.service.ts     [CRIAR]
│       ├── constants/
│       │   └── whatsapp.constants.ts     [CRIAR]
│       ├── dto/
│       │   ├── webhook-payload.dto.ts    [CRIAR]
│       │   └── send-message.dto.ts       [CRIAR]
│       ├── interfaces/
│       │   └── whatsapp.types.ts         [CRIAR]
│       └── __tests__/
│           ├── whatsapp.service.spec.ts  [CRIAR]
│           ├── whatsapp.controller.spec.ts [CRIAR]
│           ├── whatsapp.processor.spec.ts [CRIAR]
│           └── whatsapp-dedup.service.spec.ts [CRIAR]
│
├── app.module.ts                         [ATUALIZAR — BullMQ + WhatsAppModule]
└── main.ts                               [ATUALIZAR — rawBody parser]
```

---

## Decisões de Implementação Documentadas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| SDK vs axios | `axios` + `axios-retry` | SDK oficial npm `whatsapp` tem tipagem incompleta e atualizações irregulares (ADR-004) |
| Rota webhook | `/api/v1/whatsapp/webhook` | Manter prefixo global evita configuração extra em `main.ts`; registrar URL completa no Meta Console |
| Deduplicação | Redis SET NX | Mais rápido que DB; sem contention; TTL nativo; fallback para DB via `WebhookEvent` table (TAREFA-003) |
| rawBody Fastify | `addContentTypeParser` global | Abordagem mais simples; impacto mínimo de performance; substituível por middleware específico por rota |
| `@Public()` decorator | `SetMetadata` | Padrão NestJS idiomático; backward-compatible com guard global futuro |
| Retry backoff | `exponential delay: 1000` | Aproxima 1s/5s/25s do ADR-004; para valores exatos usar `backoff.type: 'custom'` |
| Typing indicator | `markAsRead` como proxy | Meta não tem endpoint nativo de "typing" para Cloud API; `read` dispara "visto" no cliente |

---

## Dependências entre Etapas

```
Etapa 1 (deps + config)
    │
    ├─→ Etapa 2 (tipos) → Etapa 3 (constantes)
    │                           │
    │                           ├─→ Etapa 4 (DTOs)
    │                           │
    │                           └─→ Etapa 5 (Service) ──┐
    │                                                    │
    │                           ┌────────────────────────┘
    │                           │
    │                           ├─→ Etapa 6 (Controller)
    │                           │
    │                           └─→ Etapa 7 (Processor)
    │
    ├─→ Etapa 8 (DedupService) → integra em Etapa 6
    │
    └─→ Etapas 9-11 (Module + AppModule) → integram tudo
              │
              └─→ Etapa 12 (Public decorator)
              └─→ Etapa 13 (rawBody main.ts)
              └─→ Etapa 14 (Testes) — paralelo após cada etapa
```

---

## Entregáveis (Checklist)

### Código

- [ ] `src/config/whatsapp.config.ts` criado
- [ ] `src/config/validation.ts` atualizado com vars `WA_*`
- [ ] `src/config/index.ts` atualizado com `whatsappConfig`
- [ ] `src/common/decorators/public.decorator.ts` criado
- [ ] `src/modules/whatsapp/interfaces/whatsapp.types.ts` criado
- [ ] `src/modules/whatsapp/constants/whatsapp.constants.ts` criado
- [ ] `src/modules/whatsapp/dto/webhook-payload.dto.ts` criado
- [ ] `src/modules/whatsapp/dto/send-message.dto.ts` criado
- [ ] `src/modules/whatsapp/whatsapp.service.ts` criado
- [ ] `src/modules/whatsapp/whatsapp.controller.ts` criado
- [ ] `src/modules/whatsapp/whatsapp.processor.ts` criado
- [ ] `src/modules/whatsapp/whatsapp-dedup.service.ts` criado
- [ ] `src/modules/whatsapp/whatsapp.module.ts` criado
- [ ] `src/app.module.ts` atualizado (BullMQ global + WhatsAppModule)
- [ ] `src/main.ts` atualizado (rawBody parser)
- [ ] `.env.example` atualizado com vars `WA_*`

### Critérios de Aceite

- [ ] `GET /api/v1/whatsapp/webhook` retorna `hub.challenge` com token correto
- [ ] `GET /api/v1/whatsapp/webhook` retorna 403 com token errado
- [ ] `POST /api/v1/whatsapp/webhook` com assinatura HMAC válida retorna 200
- [ ] `POST /api/v1/whatsapp/webhook` com assinatura HMAC inválida retorna 403
- [ ] Cada mensagem do payload é enfileirada individualmente no BullMQ
- [ ] Mensagem duplicada (mesmo `message_id`) não é reenfileirada
- [ ] Worker processa job, busca/cria usuário, envia resposta placeholder, marca como lida
- [ ] Retry automático em falhas (3 tentativas, backoff 1s/5s/25s)
- [ ] Mensagens que excedem retries ficam em DLQ (job não removido)
- [ ] Todas as mensagens recebidas e enviadas são logadas

### Testes

- [ ] `whatsapp.service.spec.ts` — ≥ 5 casos (sendText, sendTemplate, sendInteractive, sendTyping, markAsRead)
- [ ] `whatsapp.controller.spec.ts` — ≥ 7 casos (GET challenge ok/fail, POST HMAC ok/fail, dedup, múltiplas msgs, sem msgs)
- [ ] `whatsapp.processor.spec.ts` — ≥ 4 casos (processa job, cria usuário, usuário existente, onFailed DLQ)
- [ ] `whatsapp-dedup.service.spec.ts` — ≥ 3 casos (novo, duplicado, TTL)
- [ ] `pnpm test` passa sem erros

### Documentação

- [ ] `TAREFA-004-INTEGRACAO-WHATSAPP.md` com status `PENDENTE_APROVACAO`
- [ ] Comentários JSDoc nos métodos públicos do `WhatsAppService`

---

## Estimativa por Etapa

| Etapa | Descrição | Estimativa |
|-------|-----------|------------|
| 1 | Dependências, config, BullMQ no AppModule | 1h |
| 2 | Tipos e interfaces TypeScript | 30min |
| 3 | Constantes | 15min |
| 4 | DTOs | 30min |
| 5 | WhatsAppService (axios + retry) | 2h |
| 6 | WhatsAppController (webhook + HMAC) | 2h |
| 7 | WhatsAppProcessor (worker + retry + DLQ) | 2h |
| 8 | WhatsAppDedupService (Redis SET NX) | 30min |
| 9-11 | Module + AppModule + exports | 45min |
| 12 | Public decorator + JwtAuthGuard update | 30min |
| 13 | rawBody Fastify (main.ts) | 30min |
| 14 | Testes unitários (4 arquivos) | 3h |
| **Total** | | **~14h** |

> **Faixa realista:** 12–16h dependendo de curva de aprendizado com a Meta API e comportamento do Fastify com rawBody.

---

## Ações Pós-Implementação (Fora do Escopo desta Tarefa)

- **TAREFA-005/006:** Substituir resposta placeholder pelo pipeline Gemini
- **Março 2026 (obrigatório):** Atualizar certificado mTLS `meta-outbound-api-ca-2025-12.pem` antes de 31/03/2026 (ADR-004)
- **TAREFA-007:** Integrar Sentry no `onFailed` do processor
- Configurar URL do webhook no Meta Developer Console após deploy em staging
- Configurar Redis em produção (Upstash) e validar conexão TLS

---

*Plano criado em: 20/02/2026*  
*Autor: Agente de Planejamento*  
*Baseado em: ADR-004, ARCHITECTURE.md §5 e §8, TAREFA-004-INTEGRACAO-WHATSAPP.md*
