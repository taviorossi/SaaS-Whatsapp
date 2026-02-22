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
