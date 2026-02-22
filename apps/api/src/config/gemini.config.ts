import { registerAs } from '@nestjs/config';

export default registerAs('gemini', () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  fallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-1.5-pro',
  maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1024),
  temperature: Number(process.env.GEMINI_TEMPERATURE ?? 0.7),
}));
