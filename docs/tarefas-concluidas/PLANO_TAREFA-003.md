# Plano de Implementação — TAREFA-003: Backend API Core

> **Tarefa:** Backend API Core (Autenticação, Multi-tenant, Base)  
> **Versão do plano:** 1.0  
> **Data:** 20/02/2026

---

## 1. Escopo e Premissas

### 1.1 O que está no escopo

- Configuração validada (ConfigModule + validação de env)
- Camada common: exception filter global, logging interceptor, validation pipe, guards (JWT Clerk, Roles, API Key)
- AuthModule: validação de Clerk JWT (sem login/register/refresh no backend)
- UsersModule: CRUD admin com Prisma, protegido por JWT + Roles
- HealthModule: endpoint de health (DB, Redis) padronizado
- Swagger/OpenAPI
- Testes unitários para guards e filters

### 1.2 O que NÃO está no escopo

- **Login/register/refresh no backend:** O dashboard usa Clerk no frontend; o backend apenas valida o JWT emitido pelo Clerk e extrai `userId`/role para uso nos guards. Não implementar endpoints de login, register ou refresh na API.
- **Rotas públicas (webhooks):** Webhooks (WhatsApp, Stripe) não usam JWT; a validação de assinatura (X-Hub-Signature-256, Stripe signing secret) fica nos respectivos controllers (TAREFA-004/010). Para rotas "internas" que precisem de API Key, usar header `X-API-Key` e um guard opcional (placeholder que compara com env).

---

## 2. Etapas de Implementação

### Etapa 1 — Config: validação de variáveis de ambiente

**Objetivo:** Garantir que a aplicação só inicie com env vars válidas.

1. **1.1** Instalar dependência de validação: `@nestjs/config` e `zod` (ou `joi`), e criar schema de validação.
2. **1.2** Criar arquivos em `src/config/`:
   - `app.config.ts` — NODE_ENV, PORT, API_URL (e opcionalmente CLERK_PUBLISHABLE_KEY para documentação).
   - `database.config.ts` — DATABASE_URL (obrigatório).
   - `redis.config.ts` — REDIS_URL (opcional; se ausente, health e features que dependem de Redis devem degradar gracefully).
   - `auth.config.ts` — CLERK_SECRET_KEY ou CLERK_JWT_ISSUER/PUBLIC_KEY para validação JWT; API_KEY (opcional) para guard de API Key.
3. **1.3** Criar `src/config/validation.ts` (ou `env.schema.ts`): schema Zod (ou Joi) que valida todas as variáveis necessárias na inicialização (ex.: `z.object({ DATABASE_URL: z.string().url(), PORT: z.coerce.number(), ... })`). Variáveis opcionais (REDIS_URL, API_KEY) com `.optional()`.
4. **1.4** Registrar `ConfigModule.forRoot()` no `AppModule` com `validate` apontando para o schema; carregar `app.config`, `database.config`, `redis.config`, `auth.config` via `load: [...]` ou registrando cada namespace (ex.: `ConfigModule.register(load: [appConfig])`).
5. **1.5** Garantir que `main.ts` não chama `listen` até que a validação tenha passado (ConfigModule já falha no bootstrap se env for inválido).

**Entregáveis:** ConfigModule ativo, env validada na subida, tipos tipados para `ConfigService` (ex.: `ConfigService.get<number>('PORT')`).

---

### Etapa 2 — Common: Exception filter global

**Objetivo:** Respostas de erro padronizadas em toda a API.

1. **2.1** Criar `src/common/filters/all-exceptions.filter.ts` (ou `http-exception.filter.ts`):
   - Implementar `ExceptionFilter` do NestJS (interface `catch(exception, host)`).
   - Formato padrão de erro: `{ code: string, message: string, statusCode: number }`. Opcional: `error` (código legível, ex. `UNAUTHORIZED`), `timestamp`.
   - Mapear exceções NestJS (`HttpException`) para statusCode e message; exceções desconhecidas para 500 e message genérica (sem vazar stack em produção).
2. **2.2** Registrar o filter globalmente em `main.ts` com `app.useGlobalFilters(new AllExceptionsFilter())` ou via `APP_FILTER` no `AppModule`.
3. **2.3** Documentar o formato no Swagger (opcional: schema de erro nas respostas 4xx/5xx).

**Entregáveis:** Qualquer exceção não tratada retorna JSON no formato definido; testes unitários do filter (mock exception e host).

---

### Etapa 3 — Common: Logging interceptor

**Objetivo:** Log estruturado de request/response (request id, method, path, status, duration).

1. **3.1** Criar `src/common/interceptors/logging.interceptor.ts`:
   - Implementar `NestInterceptor`: gerar ou propagar `requestId` (header `X-Request-Id` ou UUID), logar no início (method, path, requestId) e no fim (statusCode, duration, requestId).
   - Usar logger injetável (ex.: `Logger` do NestJS ou logger customizado); formato estruturado (JSON ou key-value).
2. **3.2** Registrar globalmente em `main.ts` com `app.useGlobalInterceptors(new LoggingInterceptor(logger))` ou via `APP_INTERCEPTOR` no `AppModule`.
3. **3.3** Garantir que o Fastify adapter está sendo usado corretamente (request/reply para calcular duration).

**Entregáveis:** Cada request logado com requestId, method, path, status, duration; teste unitário do interceptor (mock ExecutionContext e CallHandler).

---

### Etapa 4 — Common: Validation pipe global

**Objetivo:** Validação automática de DTOs com class-validator.

1. **4.1** Instalar `class-validator` e `class-transformer`.
2. **4.2** Configurar `ValidationPipe` global em `main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))`.
3. **4.3** Documentar uso nos DTOs (decorators `@IsString`, `@IsOptional`, etc.) conforme CODING_STANDARDS; Swagger usa `@ApiProperty` com exemplos onde fizer sentido.

**Entregáveis:** Body/query params validados; erros retornados no formato do exception filter; DTOs de exemplo nos módulos criados abaixo.

---

### Etapa 5 — Common: Guards (JWT Clerk, Roles, API Key)

**Objetivo:** Proteger rotas admin com JWT Clerk e roles; opcionalmente rotas internas com API Key.

1. **5.1** **JwtAuthGuard (Clerk):**
   - Criar `src/common/guards/jwt-auth.guard.ts` (ou `clerk-auth.guard.ts`).
   - Usar `@clerk/backend` (ex.: `createClerkClient`, verificação de token) ou `jwks-rsa` + `passport-jwt` para validar o Bearer token no header `Authorization`.
   - Extrair payload (ex.: `sub` como userId, custom claims para role) e anexar ao `request` (ex.: `request.user = { id, role }`).
   - Em caso de token inválido/ausente: lançar `UnauthorizedException`.
   - Detalhe: frontend Clerk envia o token no header `Authorization: Bearer <jwt>`; o guard lê esse header, obtém o JWT, verifica assinatura via JWKS do Clerk (usando CLERK_SECRET_KEY ou JWKS URL) e extrai claims.
2. **5.2** **RolesGuard:**
   - Criar `src/common/guards/roles.guard.ts`.
   - Ler metadados do handler/controller (decorator `@Roles('admin')`) e comparar com `request.user.role`; se não permitido, lançar `ForbiddenException`.
   - Criar decorator `@Roles(...roles: string[])` em `src/common/decorators/roles.decorator.ts` (usar `SetMetadata`).
3. **5.3** **ApiKeyGuard (placeholder):**
   - Criar `src/common/guards/api-key.guard.ts`: ler header `X-API-Key`, comparar com valor de env (ex.: `API_KEY`); se não configurado ou não batendo, lançar `UnauthorizedException`. Usado em rotas "internas" que não são webhooks públicos.
4. **5.4** **Decorator @CurrentUser():**
   - Criar `src/common/decorators/current-user.decorator.ts`: retornar `request.user` (param decorator com `createParamDecorator`).

**Entregáveis:** Guards e decorators utilizáveis em controllers; testes unitários para JwtAuthGuard (mock Clerk/JWKS e request com Bearer token) e RolesGuard; ApiKeyGuard testado com header presente/ausente.

---

### Etapa 6 — AuthModule

**Objetivo:** Módulo que fornece validação Clerk JWT e decorators; sem endpoints de login/register/refresh.

1. **6.1** Criar `src/modules/auth/auth.module.ts`: importar ConfigModule, registrar serviço que encapsula a verificação do Clerk JWT (ex.: `ClerkAuthService` ou uso direto do `@clerk/backend` no guard).
2. **6.2** Opção A: Guard e serviço no Common e apenas exportar do AuthModule; Opção B: Guard no AuthModule e exportar para uso global. Recomendação: guard em common, AuthModule exporta `ClerkAuthService` (ou similar) para injeção onde for necessário validar token manualmente.
3. **6.3** Não criar controllers de login/register/refresh; documentar no código e no Swagger que a autenticação é feita via Clerk no frontend e o backend só valida o JWT.
4. **6.4** Garantir que o guard JWT usa as variáveis de ambiente (Clerk secret ou JWKS URL) do ConfigModule.

**Entregáveis:** AuthModule importado no AppModule; rotas protegidas com `@UseGuards(JwtAuthGuard)` e opcionalmente `@UseGuards(RolesGuard)` + `@Roles('admin')`; documentação no Swagger com ApiBearerAuth.

---

### Etapa 7 — UsersModule (CRUD admin)

**Objetivo:** CRUD básico de usuários para o dashboard admin, protegido por JWT + role admin.

1. **7.1** Criar `src/modules/users/users.module.ts`: importar PrismaModule (ou PrismaService global), AuthModule se necessário; registrar UsersService e UsersController.
2. **7.2** Criar `src/modules/users/users.service.ts`: métodos `findAll` (lista paginada), `findById(id)`, `update(id, dto)` usando Prisma. Model User atual pode ser estendido (email, name, role) em migration separada se necessário; mínimo: list, getById, update com os campos existentes.
3. **7.3** Criar `src/modules/users/users.controller.ts`:
   - Prefixo de rota: `api/v1/users` (ou usar `setGlobalPrefix('api/v1')` no main e controller `users`).
   - Endpoints: GET `/` (list), GET `/:id` (getById), PATCH `/:id` (update).
   - Proteção: `@UseGuards(JwtAuthGuard, RolesGuard)` e `@Roles('admin')` no controller ou nos métodos.
   - DTOs com class-validator: `UpdateUserDto` (campos opcionais editáveis); query DTO para list (page, limit).
4. **7.4** Criar DTOs em `src/modules/users/dto/`: `update-user.dto.ts`, `query-users.dto.ts`; usar `@ApiProperty` para Swagger.

**Entregáveis:** GET/PATCH em `/api/v1/users` funcionando apenas com JWT admin; respostas padronizadas; testes unitários do UsersService (mock Prisma).

---

### Etapa 8 — HealthModule

**Objetivo:** Endpoint de health único e padronizado (DB, Redis).

1. **8.1** Criar `src/modules/health/health.module.ts` e `health.controller.ts`.
2. **8.2** Endpoint: GET `/health` ou GET `/api/v1/health`. Decisão: consolidar em um único endpoint (recomendado `/api/v1/health` para manter prefixo da API). Se o projeto já tem GET `/` e GET `api/v1/health` no AppController, migrar a lógica de health para o HealthModule e remover `/api/v1/health` do AppController; manter GET `/` como alive simples (opcional) ou redirecionar documentação.
3. **8.3** Resposta padronizada: `{ status: 'ok' | 'degraded' | 'error', checks: { database: 'up' | 'down', redis: 'up' | 'down' | 'disabled' } }`. Se Redis não estiver configurado, retornar `redis: 'disabled'` e status geral ainda pode ser `ok` se DB estiver up.
4. **8.4** HealthController injeta PrismaService e opcionalmente cliente Redis; para DB: `prisma.$queryRaw` ou `prisma.$connect()`; para Redis: PING. Timeout curto (ex.: 2s) para não travar o endpoint.

**Entregáveis:** GET `/api/v1/health` (ou `/health`) retornando estrutura acima; HealthModule registrado no AppModule.

---

### Etapa 9 — Swagger / OpenAPI

**Objetivo:** Documentação automática da API.

1. **9.1** Instalar `@nestjs/swagger` e configurar no `main.ts` (ou em um módulo dedicado): `DocumentBuilder` (title: CompraZap API, version: 1.0, description), `SwaggerModule.setup('api/docs', app, document)`.
2. **9.2** Configurar segurança global: `addBearerAuth()` para JWT; aplicar `@ApiBearerAuth()` nos controllers que usam JwtAuthGuard.
3. **9.3** Decorators nos controllers: `@ApiTags('Users')`, `@ApiTags('Health')`, `@ApiOperation`, `@ApiResponse` onde necessário; DTOs com `@ApiProperty()`.
4. **9.4** Garantir que o prefixo global `api/v1` está refletido nas rotas documentadas (path no Swagger deve ser `/api/v1/...`).

**Entregáveis:** Acesso a `/api/docs` (ou caminho definido) com todas as rotas documentadas; Bearer auth configurado.

---

### Etapa 10 — Ajustes no main e AppModule

**Objetivo:** Prefixo global, CORS, registro de módulos e providers globais.

1. **10.1** Em `main.ts`: `app.setGlobalPrefix('api/v1')`. Decidir se GET `/` fica fora do prefixo (ex.: root sem prefix para alive) ou se tudo fica sob `api/v1` (ex.: health em `api/v1/health`). Ajustar AppController para não duplicar rota health; manter apenas HealthModule para health.
2. **10.2** Habilitar CORS se necessário: `app.enableCors({ origin: ... })`.
3. **10.3** AppModule: importar ConfigModule, HealthModule, AuthModule, UsersModule; registrar APP_FILTER, APP_INTERCEPTOR, APP_PIPE se usados como providers globais.

**Entregáveis:** API acessível em `http://localhost:3000/api/v1/...`; health em `http://localhost:3000/api/v1/health`; raiz opcional para alive.

---

### Etapa 11 — Testes unitários (guards, filters, interceptor)

**Objetivo:** Cobertura mínima para camada common e auth.

1. **11.1** Configurar Vitest no `apps/api` (se ainda não estiver): `vitest.config.ts`, script `test` no package.json; usar `@nestjs/testing` onde aplicável.
2. **11.2** Testes:
   - **JwtAuthGuard:** Mock do serviço/strategy que valida Clerk JWT; request com `Authorization: Bearer <token>` válido → canActivate retorna true; token inválido ou ausente → lança UnauthorizedException.
   - **RolesGuard:** Request com `user.role = 'admin'` e `@Roles('admin')` → true; role diferente → ForbiddenException.
   - **AllExceptionsFilter:** Mock exception (HttpException e Error genérico); mock host (ArgumentsHost) com getResponse; verificar que resposta JSON tem `code`, `message`, `statusCode`.
   - **LoggingInterceptor:** Mock ExecutionContext e CallHandler; verificar que next.handle() é chamado e que log é emitido (pode mockar logger).
3. **11.3** Opcional: teste unitário do ApiKeyGuard (header correto → true; incorreto ou ausente → UnauthorizedException).

**Entregáveis:** Arquivos `*.spec.ts` para os guards e filter e interceptor; `pnpm test` (ou `npm run test`) passando no api.

---

## 3. Ordem de execução sugerida

| Ordem | Etapa        | Dependências      |
|-------|--------------|-------------------|
| 1     | Config       | —                 |
| 2     | Exception filter | —             |
| 3     | Logging interceptor | —          |
| 4     | Validation pipe   | —             |
| 5     | Guards + decorators | Config       |
| 6     | AuthModule        | Config, Guards  |
| 7     | UsersModule       | Auth, Prisma    |
| 8     | HealthModule      | Config, Prisma  |
| 9     | Swagger           | —               |
| 10    | main/AppModule    | Todos           |
| 11    | Testes            | 2, 3, 5         |

---

## 4. Entregáveis (checklist)

- [x] ConfigModule com validação de env (Zod ou Joi); arquivos em `config/` (app, database, redis, auth) e registro no AppModule.
- [x] Exception filter global com formato `{ code, message, statusCode }`.
- [x] Logging interceptor com requestId, method, path, status, duration.
- [x] ValidationPipe global (class-validator).
- [x] JwtAuthGuard (validação Clerk JWT via Bearer); RolesGuard e decorator @Roles; ApiKeyGuard (X-API-Key); decorator @CurrentUser().
- [x] AuthModule (sem login/register/refresh); documentação de que o frontend usa Clerk e envia JWT.
- [x] UsersModule: CRUD list, getById, update; protegido por JwtAuthGuard + RolesGuard (admin); DTOs com class-validator.
- [x] HealthModule: GET `/api/v1/health` (ou `/health`) com checks DB e Redis e resposta padronizada.
- [x] Swagger em `/api/docs` com Bearer auth e decorators nos controllers/DTOs.
- [x] main.ts com prefixo global `api/v1`, CORS se necessário; AppModule com todos os imports.
- [x] Testes unitários: JwtAuthGuard, RolesGuard (e opcional ApiKeyGuard), AllExceptionsFilter, LoggingInterceptor.

---

## 5. Estimativa

| Etapa | Descrição                         | Horas (estimativa) |
|-------|-----------------------------------|--------------------|
| 1     | Config (validação env)            | 1,5                |
| 2     | Exception filter global           | 1                  |
| 3     | Logging interceptor               | 1                  |
| 4     | Validation pipe global            | 0,5                |
| 5     | Guards (JWT, Roles, API Key)      | 2,5                |
| 6     | AuthModule                        | 1                  |
| 7     | UsersModule (CRUD)                | 2                  |
| 8     | HealthModule                      | 1                  |
| 9     | Swagger                           | 1,5                |
| 10    | main/AppModule                    | 0,5                |
| 11    | Testes unitários                  | 2                  |
| **Total** |                                | **~14,5 h**        |

---

## 6. Referências

- `docs/ARCHITECTURE.md` — estrutura API, guards (clerk-auth, rate-limit), config, padrões (prefixo /api/v1/, Clerk JWT para admin).
- `docs/CODING_STANDARDS.md` — convenções NestJS, DTOs com class-validator.
- `docs/tarefas-concluidas/TAREFA-003-BACKEND-CORE.md` — critérios de aceite.
