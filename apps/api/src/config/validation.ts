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
