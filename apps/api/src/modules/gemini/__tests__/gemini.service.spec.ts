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
