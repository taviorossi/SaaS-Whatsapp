# TAREFA-003: Backend API Core (Autenticação, Multi-tenant, Base)

## Contexto
O backend é o coração do sistema. Precisa orquestrar WhatsApp, Gemini, banco de dados e servir o dashboard admin. Essa tarefa foca na fundação: autenticação, estrutura modular, middlewares, e configuração base.

## Problema/Necessidade
Criar a estrutura base do backend NestJS com autenticação, guards, interceptors, exception filters, logging, health checks e a base para todos os módulos.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Módulos base necessários:**
- `AuthModule` - JWT + API Key para webhooks
- `UsersModule` - CRUD de usuários (admin)
- `HealthModule` - Health checks (DB, Redis, WhatsApp)
- `CommonModule` - Guards, filters, interceptors, pipes

**Estrutura:**
```
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── configuration.ts
│   └── validation.ts
├── common/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   └── decorators/
└── modules/
    ├── auth/
    ├── users/
    └── health/
```

**Padrões:**
- ConfigModule com validação Joi/Zod
- Exception filter global (HTTP + WS)
- Request logging interceptor
- Validation pipe global (class-validator)
- Swagger/OpenAPI automático

## Critérios de Aceite
- [x] NestJS rodando com estrutura modular
- [x] Autenticação JWT funcionando (validação Clerk no backend; login/register/refresh no frontend)
- [x] Guards de autenticação e roles
- [x] Exception filter global com respostas padronizadas
- [x] Logging estruturado (request/response)
- [x] Health check endpoint (/health)
- [x] Swagger documentação automática
- [x] Validação de env vars na inicialização
- [x] Testes unitários dos guards e filters

## Classificação
- **Tipo:** Feature
- **Prioridade:** Crítica
- **Área:** Backend
- **Nível:** N16
- **Status:** CONCLUÍDA

## Plano
- **Plano de implementação:** [PLANO_TAREFA-003.md](./PLANO_TAREFA-003.md)

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
