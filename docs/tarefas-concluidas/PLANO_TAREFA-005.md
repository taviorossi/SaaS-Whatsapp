# PLANO DE EXECUÇÃO — TAREFA-005: Integração Gemini API

> **Status:** CONCLUÍDA
> **Criado em:** 20/02/2026
> **Estimativa total:** 6–8 horas

---

## 1. Resumo

Implementa o módulo `GeminiModule` que integra o Google Gemini 2.0 Flash ao CompraZap. O módulo gerencia histórico de conversa por usuário via Redis (TTL 7 dias), processa mensagens com system prompt especializado em compras, suporta saída estruturada (JSON) para listas, e se conecta ao `WhatsAppProcessor` substituindo o placeholder atual. Inclui fallback para `gemini-1.5-pro`, extração de `RedisModule` global e cobertura de testes unitários com mocks.

---

## 2. Dependências a Adicionar

```bash
# Executar em apps/api/
npm install @google/generative-ai
```

Isso adiciona o SDK oficial do Google Gemini para Node.js ao `apps/api/package.json`.

---

## 3. Etapas de Implementação

---

### Etapa 1 — Instalar dependência `@google/generative-ai`

**Arquivo afetado:** `apps/api/package.json`

```bash
cd apps/api && npm install @google/generative-ai
```

**Resultado esperado:** `"@google/generative-ai": "^0.x.x"` aparece em `dependencies`.

---

### Etapa 2 — Adicionar variáveis Gemini ao schema de validação

**Arquivo afetado:** `apps/api/src/config/validation.ts`

Adicionar ao objeto `envSchema` (após o bloco `WA_API_VERSION`):

```typescript
// apps/api/src/config/validation.ts — conteúdo COMPLETO após edição

import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_JWT_ISSUER: z.string().url().optional(),
  API_KEY: z.string().optional(),
  API_URL: z.string().url().optional(),
  // WhatsApp / Meta Cloud API
  WA_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WA_ACCESS_TOKEN: z.string().min(1).optional(),
  WA_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
  WA_APP_SECRET: z.string().min(1).optional(),
  WA_API_VERSION: z.string().default('v21.0'),
  // Gemini API
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_FALLBACK_MODEL: z.string().default('gemini-1.5-pro'),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().default(1024),
  GEMINI_TEMPERATURE: z.coerce.number().default(0.7),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(env: unknown): Env {
  return envSchema.parse(env);
}
```

**Nota:** Apenas adicionar o bloco `// Gemini API` com os 5 campos ao objeto existente — não reescrever o arquivo inteiro a menos que necessário.

---

### Etapa 3 — Criar `gemini.config.ts`

**Arquivo novo:** `apps/api/src/config/gemini.config.ts`

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  fallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-1.5-pro',
  maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1024),
  temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.7),
}));
```

---

### Etapa 4 — Registrar `geminiConfig` no `configLoaders`

**Arquivo afetado:** `apps/api/src/config/index.ts`

```typescript
import appConfig from './app.config';
import authConfig from './auth.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import whatsappConfig from './whatsapp.config';
import geminiConfig from './gemini.config';
import { validateEnv } from './validation';

export { validateEnv };
export { envSchema } from './validation';
export type { Env } from './validation';

export const configLoaders = [
  appConfig,
  databaseConfig,
  redisConfig,
  authConfig,
  whatsappConfig,
  geminiConfig,
];
```

---

### Etapa 5 — Criar `RedisModule` global

**Arquivo novo:** `apps/api/src/redis/redis.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Redis = require('ioredis') as typeof import('ioredis').default;
        const url = config.get<string>('redis.url');
        return url ? new Redis(url) : new Redis();
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

**Nota de implementação:**
- O `REDIS_CLIENT` token é exportado daqui e será importado tanto por `WhatsAppDedupService` quanto por `GeminiService`.
- O `@Global()` faz com que qualquer módulo que importe `RedisModule` no `AppModule` tenha acesso ao provider sem precisar importar `RedisModule` explicitamente em cada módulo.

---

### Etapa 6 — Refatorar `WhatsAppModule` para usar `RedisModule`

**Arquivo afetado:** `apps/api/src/modules/whatsapp/whatsapp.module.ts`

Remover o provider inline `REDIS_CLIENT` e importar `RedisModule`. Atualizar o import do token `REDIS_CLIENT` em `whatsapp-dedup.service.ts`.

**`apps/api/src/modules/whatsapp/whatsapp.module.ts` — conteúdo COMPLETO após refatoração:**

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
  providers: [WhatsAppService, WhatsAppProcessor, WhatsAppDedupService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

**`apps/api/src/modules/whatsapp/whatsapp-dedup.service.ts` — ajuste no import do token:**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';  // ← alterar esta linha
import {
  WHATSAPP_DEDUP_KEY_PREFIX,
  WHATSAPP_DEDUP_TTL_SECONDS,
} from './constants/whatsapp.constants';

@Injectable()
export class WhatsAppDedupService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

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
```

---

### Etapa 7 — Criar `AppModule` importando `RedisModule`

**Arquivo afetado:** `apps/api/src/app.module.ts`

Adicionar `RedisModule` ao array `imports` (antes de `WhatsAppModule`):

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configLoaders, validateEnv } from './config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      validate: (config) => validateEnv(config),
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url'),
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
```

---

### Etapa 8 — Criar `gemini.constants.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/constants/gemini.constants.ts`

```typescript
export const GEMINI_HISTORY_KEY_PREFIX = 'gemini:history:';
export const GEMINI_HISTORY_TTL_SECONDS = 604800; // 7 dias
export const GEMINI_MAX_HISTORY_MESSAGES = 40; // 20 pares user/model
export const GEMINI_MAX_OUTPUT_TOKENS = 1024;
export const GEMINI_TEMPERATURE = 0.7;

/** Códigos de erro da API Gemini que justificam fallback */
export const GEMINI_RETRYABLE_ERROR_CODES = [
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'INTERNAL',
];
```

---

### Etapa 9 — Criar `gemini.types.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/interfaces/gemini.types.ts`

```typescript
/** Formato nativo do SDK Gemini para histórico de conversa */
export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

/** Contexto adicional passado ao método chat */
export interface ChatContext {
  userName?: string;
  currentList?: string[];
}

/** Item individual de uma lista de compras estruturada */
export interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  priority: 'high' | 'medium' | 'low';
  estimatedPrice?: number;
}

/** Resultado de geração de lista estruturada */
export interface ShoppingListOutput {
  items: ShoppingItem[];
  totalEstimated?: number;
  suggestions?: string[];
}

/** Resultado interno do método chat com metadados */
export interface GeminiChatResult {
  text: string;
  tokensUsed?: number;
  modelUsed: string;
}
```

---

### Etapa 10 — Criar `gemini.prompts.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/gemini.prompts.ts`

```typescript
/**
 * System prompt principal do CompraZap.
 * Define personalidade, escopo e regras de resposta do assistente.
 */
export const COMPRAZAP_SYSTEM_PROMPT = `Você é o CompraZap, um assistente pessoal de compras inteligente e amigável.
Seu objetivo é ajudar o usuário a planejar, organizar e otimizar suas compras.

Você pode:
- Criar e organizar listas de compras
- Sugerir quantidades e marcas por faixa de preço
- Priorizar itens essenciais dentro de um orçamento
- Dar dicas de economia e substituições
- Lembrar preferências do usuário mencionadas anteriormente

Regras:
- Sempre responda em português brasileiro, de forma amigável e concisa
- Mensagens curtas (máx. 3 parágrafos) para melhor leitura no WhatsApp
- Use emojis com moderação (1-2 por mensagem)
- Quando criar listas, use formato numerado
- Se o usuário pedir uma lista estruturada, responda com JSON válido dentro de \`\`\`json ... \`\`\`
- NUNCA discuta outros temas além de compras, economia doméstica e planejamento financeiro relacionado
- Se perguntarem algo fora do escopo, redirecione gentilmente para o tema de compras`;

/**
 * Prompt de instrução para gerar lista de compras em formato JSON.
 * Usado pelo método generateShoppingList().
 */
export const SHOPPING_LIST_JSON_PROMPT = `Gere uma lista de compras estruturada em JSON com base na solicitação do usuário.
O formato deve ser exatamente:
\`\`\`json
{
  "items": [
    {
      "name": "Nome do produto",
      "quantity": 1,
      "unit": "unidade|kg|litro|pacote",
      "priority": "high|medium|low",
      "estimatedPrice": 0.00
    }
  ],
  "totalEstimated": 0.00,
  "suggestions": ["dica 1", "dica 2"]
}
\`\`\`
Responda APENAS com o bloco JSON, sem texto adicional.`;

/**
 * Mensagem de fallback retornada quando ambos os modelos Gemini falham.
 */
export const GEMINI_FALLBACK_MESSAGE =
  'Desculpe, estou com dificuldades técnicas no momento. 🛒 Tente novamente em alguns instantes!';
```

---

### Etapa 11 — Criar `gemini.service.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/gemini.service.ts`

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/generative-ai';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import {
  GEMINI_HISTORY_KEY_PREFIX,
  GEMINI_HISTORY_TTL_SECONDS,
  GEMINI_MAX_HISTORY_MESSAGES,
  GEMINI_RETRYABLE_ERROR_CODES,
} from './constants/gemini.constants';
import {
  COMPRAZAP_SYSTEM_PROMPT,
  GEMINI_FALLBACK_MESSAGE,
  SHOPPING_LIST_JSON_PROMPT,
} from './gemini.prompts';
import type {
  ChatContext,
  ChatMessage,
  GeminiChatResult,
  ShoppingListOutput,
} from './interfaces/gemini.types';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly maxOutputTokens: number;
  private readonly temperature: number;

  private readonly safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const apiKey = this.config.get<string>('gemini.apiKey') ?? '';
    this.client = new GoogleGenerativeAI(apiKey);
    this.primaryModel = this.config.get<string>('gemini.model') ?? 'gemini-2.0-flash';
    this.fallbackModel =
      this.config.get<string>('gemini.fallbackModel') ?? 'gemini-1.5-pro';
    this.maxOutputTokens = this.config.get<number>('gemini.maxOutputTokens') ?? 1024;
    this.temperature = this.config.get<number>('gemini.temperature') ?? 0.7;
  }

  /**
   * Envia uma mensagem ao Gemini com histórico completo de conversa.
   * Tenta o modelo primário e, em caso de erro retryable, usa o fallback.
   */
  async chat(
    userId: string,
    userMessage: string,
    context?: ChatContext,
  ): Promise<string> {
    try {
      const result = await this.chatWithModel(
        this.primaryModel,
        userId,
        userMessage,
        context,
      );
      return result.text;
    } catch (primaryError) {
      if (this.isRetryableError(primaryError)) {
        this.logger.warn(
          `Primary model (${this.primaryModel}) failed, trying fallback. Error: ${(primaryError as Error).message}`,
        );
        try {
          const result = await this.chatWithModel(
            this.fallbackModel,
            userId,
            userMessage,
            context,
          );
          return result.text;
        } catch (fallbackError) {
          this.logger.error(
            `Fallback model (${this.fallbackModel}) also failed: ${(fallbackError as Error).message}`,
            (fallbackError as Error).stack,
          );
          return GEMINI_FALLBACK_MESSAGE;
        }
      }
      this.logger.error(
        `Non-retryable error from Gemini: ${(primaryError as Error).message}`,
        (primaryError as Error).stack,
      );
      return GEMINI_FALLBACK_MESSAGE;
    }
  }

  /**
   * Gera uma lista de compras estruturada (ShoppingListOutput) em JSON.
   */
  async generateShoppingList(
    userId: string,
    prompt: string,
  ): Promise<ShoppingListOutput> {
    const fullPrompt = `${SHOPPING_LIST_JSON_PROMPT}\n\nSolicitação: ${prompt}`;
    const rawText = await this.chat(userId, fullPrompt);
    return this.parseJsonResponse<ShoppingListOutput>(rawText) ?? {
      items: [],
      suggestions: ['Não foi possível gerar a lista. Tente ser mais específico.'],
    };
  }

  /**
   * Apaga o histórico de conversa de um usuário no Redis.
   */
  async clearHistory(userId: string): Promise<void> {
    const key = `${GEMINI_HISTORY_KEY_PREFIX}${userId}`;
    await this.redis.del(key);
    this.logger.log(`History cleared for user ${userId}`);
  }

  // ─── Private methods ────────────────────────────────────────────────────────

  private async chatWithModel(
    modelName: string,
    userId: string,
    userMessage: string,
    context?: ChatContext,
  ): Promise<GeminiChatResult> {
    const startTime = Date.now();
    const history = await this.loadHistory(userId);

    const systemInstruction = this.buildSystemInstruction(context);

    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
      },
      safetySettings: this.safetySettings,
    });

    const chatSession = model.startChat({ history });
    const response = await chatSession.sendMessage(userMessage);
    const responseText = response.response.text();
    const tokensUsed = response.response.usageMetadata?.totalTokenCount;
    const latencyMs = Date.now() - startTime;

    this.logger.log(
      `Gemini [${modelName}] | user=${userId} | tokens=${tokensUsed ?? 'N/A'} | latency=${latencyMs}ms`,
    );

    await this.saveHistory(userId, userMessage, responseText);

    const extractedJson = this.extractJsonBlock(responseText);
    const finalText = extractedJson
      ? JSON.stringify(JSON.parse(extractedJson), null, 2)
      : responseText;

    return { text: finalText, tokensUsed, modelUsed: modelName };
  }

  private async loadHistory(userId: string): Promise<ChatMessage[]> {
    const key = `${GEMINI_HISTORY_KEY_PREFIX}${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChatMessage[];
    } catch {
      this.logger.warn(`Corrupt history for user ${userId}, resetting.`);
      return [];
    }
  }

  private async saveHistory(
    userId: string,
    userText: string,
    modelText: string,
  ): Promise<void> {
    const key = `${GEMINI_HISTORY_KEY_PREFIX}${userId}`;
    const history = await this.loadHistory(userId);

    history.push(
      { role: 'user', parts: [{ text: userText }] },
      { role: 'model', parts: [{ text: modelText }] },
    );

    // Truncar histórico se exceder o limite (mantém as mensagens mais recentes)
    const trimmed =
      history.length > GEMINI_MAX_HISTORY_MESSAGES
        ? history.slice(history.length - GEMINI_MAX_HISTORY_MESSAGES)
        : history;

    await this.redis.set(key, JSON.stringify(trimmed), 'EX', GEMINI_HISTORY_TTL_SECONDS);
  }

  private buildSystemInstruction(context?: ChatContext): string {
    let instruction = COMPRAZAP_SYSTEM_PROMPT;
    if (context?.userName) {
      instruction += `\n\nO nome do usuário é: ${context.userName}`;
    }
    if (context?.currentList?.length) {
      instruction += `\n\nLista atual do usuário: ${context.currentList.join(', ')}`;
    }
    return instruction;
  }

  private extractJsonBlock(text: string): string | null {
    const match = /```json\s*([\s\S]*?)\s*```/i.exec(text);
    return match ? match[1].trim() : null;
  }

  private parseJsonResponse<T>(text: string): T | null {
    const jsonBlock = this.extractJsonBlock(text);
    const jsonStr = jsonBlock ?? text.trim();
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      this.logger.warn(`Failed to parse JSON response: ${jsonStr.slice(0, 100)}`);
      return null;
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return GEMINI_RETRYABLE_ERROR_CODES.some((code) =>
      error.message.includes(code),
    );
  }
}
```

---

### Etapa 12 — Criar `gemini.module.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/gemini.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiService } from './gemini.service';

@Module({
  imports: [ConfigModule],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
```

**Nota:** `REDIS_CLIENT` é injetado via `RedisModule` global — não é necessário importar `RedisModule` aqui.

---

### Etapa 13 — Criar testes unitários `gemini.service.spec.ts`

**Arquivo novo:** `apps/api/src/modules/gemini/__tests__/gemini.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../gemini.service';
import { REDIS_CLIENT } from '../../../redis/redis.module';
import { GEMINI_FALLBACK_MESSAGE } from '../gemini.prompts';
import { GEMINI_HISTORY_KEY_PREFIX } from '../constants/gemini.constants';

// ── Mock do SDK @google/generative-ai ──────────────────────────────────────
const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: {
    BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────
function makeSuccessResponse(text: string, tokens = 100) {
  return {
    response: {
      text: () => text,
      usageMetadata: { totalTokenCount: tokens },
    },
  };
}

describe('GeminiService', () => {
  let service: GeminiService;
  let redisMock: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, unknown> = {
                'gemini.apiKey': 'test-key',
                'gemini.model': 'gemini-2.0-flash',
                'gemini.fallbackModel': 'gemini-1.5-pro',
                'gemini.maxOutputTokens': 1024,
                'gemini.temperature': 0.7,
              };
              return cfg[key];
            }),
          },
        },
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue(makeSuccessResponse('Olá! Como posso ajudar?'));
  });

  // ── chat() com histórico vazio ──────────────────────────────────────────
  describe('chat()', () => {
    it('deve chamar o SDK e retornar texto quando histórico vazio', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.chat('user-1', 'Quero comprar arroz');

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.0-flash' }),
      );
      expect(mockSendMessage).toHaveBeenCalledWith('Quero comprar arroz');
      expect(result).toBe('Olá! Como posso ajudar?');
      expect(redisMock.set).toHaveBeenCalledWith(
        `${GEMINI_HISTORY_KEY_PREFIX}user-1`,
        expect.any(String),
        'EX',
        604800,
      );
    });

    it('deve carregar histórico existente do Redis e enviar com ele', async () => {
      const existingHistory = [
        { role: 'user', parts: [{ text: 'Olá' }] },
        { role: 'model', parts: [{ text: 'Olá! Sou o CompraZap.' }] },
      ];
      redisMock.get.mockResolvedValue(JSON.stringify(existingHistory));

      await service.chat('user-2', 'Crie uma lista de compras');

      expect(mockStartChat).toHaveBeenCalledWith(
        expect.objectContaining({ history: existingHistory }),
      );
    });

    it('deve tentar modelo fallback quando primário falha com RESOURCE_EXHAUSTED', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED: quota exceeded'))
        .mockResolvedValueOnce(makeSuccessResponse('Resposta do fallback'));

      const result = await service.chat('user-3', 'Teste de fallback');

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
      expect(mockGetGenerativeModel).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: 'gemini-1.5-pro' }),
      );
      expect(result).toBe('Resposta do fallback');
    });

    it('deve retornar mensagem amigável quando ambos os modelos falham', async () => {
      mockSendMessage
        .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'))
        .mockRejectedValueOnce(new Error('UNAVAILABLE'));

      const result = await service.chat('user-4', 'Mensagem qualquer');

      expect(result).toBe(GEMINI_FALLBACK_MESSAGE);
    });

    it('deve retornar mensagem amigável para erro não-retryable', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('INVALID_ARGUMENT: bad request'));

      const result = await service.chat('user-5', 'Mensagem qualquer');

      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(1);
      expect(result).toBe(GEMINI_FALLBACK_MESSAGE);
    });

    it('deve extrair e formatar JSON quando resposta contém bloco ```json```', async () => {
      const jsonText = '```json\n{"items":[],"totalEstimated":0}\n```';
      mockSendMessage.mockResolvedValue(makeSuccessResponse(jsonText));

      const result = await service.chat('user-6', 'Lista em JSON');

      expect(result).toContain('"items"');
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  // ── generateShoppingList() ──────────────────────────────────────────────
  describe('generateShoppingList()', () => {
    it('deve retornar ShoppingListOutput parseado', async () => {
      const mockList = {
        items: [{ name: 'Arroz', quantity: 2, unit: 'kg', priority: 'high' }],
        totalEstimated: 15.0,
        suggestions: ['Compre em atacado'],
      };
      mockSendMessage.mockResolvedValue(
        makeSuccessResponse(`\`\`\`json\n${JSON.stringify(mockList)}\n\`\`\``),
      );

      const result = await service.generateShoppingList('user-7', 'Lista para semana');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Arroz');
      expect(result.totalEstimated).toBe(15.0);
    });

    it('deve retornar lista vazia quando parsing falha', async () => {
      mockSendMessage.mockResolvedValue(makeSuccessResponse('Resposta inválida'));

      const result = await service.generateShoppingList('user-8', 'Lista');

      expect(result.items).toHaveLength(0);
    });
  });

  // ── clearHistory() ──────────────────────────────────────────────────────
  describe('clearHistory()', () => {
    it('deve deletar a chave do Redis', async () => {
      await service.clearHistory('user-9');

      expect(redisMock.del).toHaveBeenCalledWith(
        `${GEMINI_HISTORY_KEY_PREFIX}user-9`,
      );
    });
  });
});
```

---

### Etapa 14 — Atualizar `WhatsAppProcessor` para usar `GeminiService`

**Arquivo afetado:** `apps/api/src/modules/whatsapp/whatsapp.processor.ts`

```typescript
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
```

---

### Etapa 15 — Atualizar `WhatsAppModule` para importar `GeminiModule`

**Arquivo afetado:** `apps/api/src/modules/whatsapp/whatsapp.module.ts`

Adicionar `GeminiModule` ao array `imports` (o `GeminiService` precisa ser injetável no `WhatsAppProcessor`):

```typescript
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
```

---

### Etapa 16 — Registrar `GeminiModule` no `AppModule`

**Arquivo afetado:** `apps/api/src/app.module.ts`

Adicionar `GeminiModule` ao array `imports` (após `WhatsAppModule`):

```typescript
// Adicionar import:
import { GeminiModule } from './modules/gemini/gemini.module';

// Adicionar ao array imports:
GeminiModule,
```

**Nota:** Como `GeminiModule` já é importado por `WhatsAppModule`, importar no `AppModule` é opcional para funcionamento, mas recomendado para deixar o módulo disponível globalmente caso outros módulos precisem no futuro.

---

### Etapa 17 — Adicionar `.env.example` com variáveis Gemini

**Arquivo afetado:** `apps/api/.env.example` (ou `.env.local`)

Adicionar ao final:

```dotenv
# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_FALLBACK_MODEL=gemini-1.5-pro
GEMINI_MAX_OUTPUT_TOKENS=1024
GEMINI_TEMPERATURE=0.7
```

---

## 4. Estrutura Final de Arquivos

```
apps/api/src/
├── config/
│   ├── gemini.config.ts          ← NOVO
│   ├── index.ts                  ← ATUALIZADO (geminiConfig em configLoaders)
│   └── validation.ts             ← ATUALIZADO (5 vars Gemini)
├── redis/
│   └── redis.module.ts           ← NOVO (RedisModule global)
├── modules/
│   ├── gemini/                   ← NOVO (módulo completo)
│   │   ├── gemini.module.ts
│   │   ├── gemini.service.ts
│   │   ├── gemini.prompts.ts
│   │   ├── constants/
│   │   │   └── gemini.constants.ts
│   │   ├── interfaces/
│   │   │   └── gemini.types.ts
│   │   └── __tests__/
│   │       └── gemini.service.spec.ts
│   └── whatsapp/
│       ├── whatsapp.module.ts    ← ATUALIZADO (remove REDIS_CLIENT inline, add GeminiModule)
│       ├── whatsapp.processor.ts ← ATUALIZADO (conecta GeminiService, remove placeholder)
│       └── whatsapp-dedup.service.ts ← ATUALIZADO (import REDIS_CLIENT de redis.module)
└── app.module.ts                 ← ATUALIZADO (importa RedisModule, GeminiModule)
```

---

## 5. Ordem de Execução

| # | Etapa | Tipo | Arquivo principal |
|---|-------|------|-------------------|
| 1 | Instalar `@google/generative-ai` | Shell | `package.json` |
| 2 | Adicionar vars Gemini ao schema Zod | Edit | `validation.ts` |
| 3 | Criar `gemini.config.ts` | New | `config/gemini.config.ts` |
| 4 | Registrar `geminiConfig` em `configLoaders` | Edit | `config/index.ts` |
| 5 | Criar `RedisModule` global | New | `redis/redis.module.ts` |
| 6 | Refatorar `WhatsAppModule` (remover REDIS inline) | Edit | `whatsapp.module.ts` |
| 7 | Atualizar import REDIS_CLIENT no `WhatsAppDedupService` | Edit | `whatsapp-dedup.service.ts` |
| 8 | Adicionar `RedisModule` ao `AppModule` | Edit | `app.module.ts` |
| 9 | Criar `gemini.constants.ts` | New | `gemini/constants/` |
| 10 | Criar `gemini.types.ts` | New | `gemini/interfaces/` |
| 11 | Criar `gemini.prompts.ts` | New | `gemini/` |
| 12 | Criar `gemini.service.ts` | New | `gemini/` |
| 13 | Criar `gemini.module.ts` | New | `gemini/` |
| 14 | Criar `gemini.service.spec.ts` | New | `gemini/__tests__/` |
| 15 | Atualizar `WhatsAppProcessor` (substituir placeholder) | Edit | `whatsapp.processor.ts` |
| 16 | Atualizar `WhatsAppModule` (importar `GeminiModule`) | Edit | `whatsapp.module.ts` |
| 17 | Atualizar `.env.example` | Edit | `.env.example` |

---

## 6. Estimativa de Tempo

| Etapa | Tempo estimado |
|-------|----------------|
| Etapas 1–4 (config/env) | 30 min |
| Etapas 5–8 (RedisModule + refatoração) | 45 min |
| Etapas 9–13 (GeminiModule completo) | 2h |
| Etapa 14 (testes) | 1h 30min |
| Etapas 15–17 (integração processor + docs) | 45 min |
| **Total** | **~6 horas** |

---

## 7. Pontos de Atenção / Riscos

### 7.1 — `REDIS_CLIENT` token duplicado
O token `REDIS_CLIENT` está atualmente exportado de `whatsapp-dedup.service.ts` e também será definido em `redis/redis.module.ts`. Após criar `RedisModule`, o `WhatsAppDedupService` **deve** atualizar seu import para apontar para `../../redis/redis.module`. Não fazer isso causará dois providers com o mesmo token string `'REDIS_CLIENT'` injetados de fontes diferentes, causando conflito silencioso.

### 7.2 — `@Global()` no `RedisModule`
O decorator `@Global()` só tem efeito quando o módulo é registrado no módulo raiz (`AppModule`). Se `RedisModule` for importado apenas em `WhatsAppModule` ou `GeminiModule`, o `@Global()` não terá efeito fora desses contextos. **Registrar no `AppModule` é obrigatório** para o comportamento global funcionar corretamente.

### 7.3 — API Key em produção
A variável `GEMINI_API_KEY` é `optional()` no schema Zod. Em produção, se não definida, o SDK lançará erro na primeira chamada. O `GeminiService` captura o erro e retorna `GEMINI_FALLBACK_MESSAGE`, mas o comportamento silencioso pode mascarar misconfiguration. Recomendado: adicionar log de warning no `constructor` se `apiKey` estiver vazia.

### 7.4 — Versão do SDK `@google/generative-ai`
O SDK pode ter breaking changes entre minor versions. Fixar a versão no `package.json` (`"@google/generative-ai": "0.x.x"`) após verificar a versão instalada. Os tipos `HarmCategory` e `HarmBlockThreshold` podem ser enums numéricos em versões mais recentes — verificar no momento da instalação.

### 7.5 — Formato `gemini-2.0-flash`
O nome do modelo `gemini-2.0-flash` deve corresponder exatamente ao identificador aceito pela API. Verificar na [documentação oficial](https://ai.google.dev/gemini-api/docs/models/gemini) no momento da implementação. Alternativa: `gemini-2.0-flash-exp` se o modelo ainda estiver em experimental.

### 7.6 — Histórico em Redis vs. banco de dados
Esta implementação usa Redis como cache temporário (TTL 7 dias). Quando a TAREFA-007 for implementada, o histórico deve ser migrado para persistência em banco de dados. Não adicionar acoplamento direto ao Prisma nesta tarefa.

### 7.7 — Testes de integração
Os testes desta tarefa são unitários com mocks do SDK. Testes de integração end-to-end requerem uma GEMINI_API_KEY real e devem ser executados em um ambiente separado (e.g., `jest.config.integration.ts`).
