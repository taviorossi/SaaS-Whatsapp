import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { FastifyInstance } from 'fastify';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3000);

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true }); // allow all in dev; tighten in production

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const documentBuilder = new DocumentBuilder()
    .setTitle('CompraZap API')
    .setVersion('1.0')
    .setDescription(
      'API do CompraZap. Autenticação via Clerk (frontend); envie o JWT no header Authorization: Bearer <token>.',
    )
    .addBearerAuth();
  const document = SwaggerModule.createDocument(app, documentBuilder.build());
  SwaggerModule.setup('api/docs', app, document);

  // Preservar raw body para validação HMAC no webhook do WhatsApp.
  // Sobrescreve o parser padrão do Fastify para application/json e expõe
  // req.rawBody como Buffer antes do parse, sem overhead adicional.
  const fastifyInstance = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastifyInstance.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body: Buffer, done) => {
      try {
        const parsed = JSON.parse(body.toString('utf8')) as unknown;
        (_req as Record<string, unknown>).rawBody = body;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.listen(port, '0.0.0.0');
}

bootstrap();
