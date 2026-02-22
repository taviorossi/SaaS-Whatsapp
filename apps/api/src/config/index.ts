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
