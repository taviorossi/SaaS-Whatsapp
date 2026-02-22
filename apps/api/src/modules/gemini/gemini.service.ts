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
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set — Gemini calls will fail at runtime');
    }
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
    return (
      this.parseJsonResponse<ShoppingListOutput>(rawText) ?? {
        items: [],
        suggestions: ['Não foi possível gerar a lista. Tente ser mais específico.'],
      }
    );
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
