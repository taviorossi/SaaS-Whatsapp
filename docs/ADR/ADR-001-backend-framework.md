# ADR-001: Backend Framework — NestJS com Fastify Adapter

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O CompraZap precisa de um backend Node.js/TypeScript que suporte:
- 7+ módulos distintos (WhatsApp, Gemini, Chat, Shopping, Users, Billing, Admin)
- Processamento assíncrono de mensagens via filas (BullMQ)
- Integração com múltiplos serviços externos (Meta API, Gemini API, Stripe)
- Webhooks com validação e processamento confiável
- Autenticação/autorização em múltiplas camadas
- API REST documentada com OpenAPI/Swagger
- Boa developer experience para crescimento da equipe

Precisamos de um framework que equilibre produtividade, estrutura e performance.

## Decision

Usar **NestJS** como framework principal, substituindo o HTTP adapter padrão (Express) pelo **Fastify adapter** para melhor performance.

### Stack específica:
- `@nestjs/core` + `@nestjs/platform-fastify`
- `@nestjs/config` para configuração
- `@nestjs/swagger` para documentação automática
- `@nestjs/bullmq` para filas
- `class-validator` + `class-transformer` para validação

## Alternatives Considered

### Fastify Puro

**Prós:**
- ~2x mais rápido que Express, performance equivalente quando usado como adapter no NestJS
- Plugin system limpo e extensível

**Contras:**
- Sem DI nativo — necessário adicionar (awilix, tsyringe) e configurar manualmente
- Sem estrutura opinada — cada dev organiza código de forma diferente
- Sem guards, interceptors, pipes, exception filters nativos
- Integrações (Swagger, BullMQ, Config) exigem setup manual

**Veredicto:** Para um SaaS com 7+ módulos, o custo de montar toda a infraestrutura manualmente supera o ganho de performance marginal vs NestJS+Fastify.

### Hono

**Prós:**
- Ultra-leve (~14KB), startup rápido
- Excelente para edge/serverless
- API moderna e ergonômica

**Contras:**
- Otimizado para serverless — nosso backend é stateful (BullMQ workers, long-running connections)
- Ecossistema imaturo para SaaS backend (sem equivalente a @nestjs/bullmq, @nestjs/swagger)
- Sem DI nativo
- Comunidade menor, menos exemplos de produção para projetos complexos

**Veredicto:** Inadequado para um backend que precisa de workers long-running, filas persistentes e múltiplas integrações complexas.

## Consequences

### Positivas
- Estrutura modular opinada reduz decisões de arquitetura e acelera onboarding
- DI nativo facilita testabilidade (mock de services via injection)
- Ecossistema de @nestjs/* packages cobre quase todas as necessidades
- Fastify adapter entrega ~2x throughput vs Express sem perder features NestJS
- Swagger/OpenAPI gerado automaticamente a partir de decorators
- Guards + interceptors padronizam autenticação e logging transversalmente

### Negativas
- Curva de aprendizado alta (decorators, DI, módulos) para devs novos em NestJS
- Overhead de abstração vs framework mínimo — aceitável para nosso escopo
- Fastify adapter pode ter incompatibilidade com middleware Express legacy — mitigado por não usar middleware Express
- Bundle size maior que frameworks minimalistas — irrelevante para API server

### Riscos
- Prisma 7 + NestJS: verificar compatibilidade ESM completa no setup inicial
- Fastify adapter: garantir que todas as libs do ecossistema suportem (testar @sentry/node com Fastify)
