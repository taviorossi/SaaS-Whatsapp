import { registerAs } from '@nestjs/config';

export default registerAs(
  'auth',
  () => ({
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    clerkJwtIssuer: process.env.CLERK_JWT_ISSUER,
    apiKey: process.env.API_KEY,
  }),
);
