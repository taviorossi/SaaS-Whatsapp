import { registerAs } from '@nestjs/config';

export default registerAs('whatsapp', () => ({
  phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
  accessToken: process.env.WA_ACCESS_TOKEN,
  webhookVerifyToken: process.env.WA_WEBHOOK_VERIFY_TOKEN,
  appSecret: process.env.WA_APP_SECRET,
  apiVersion: process.env.WA_API_VERSION ?? 'v21.0',
  baseUrl: 'https://graph.facebook.com',
}));
