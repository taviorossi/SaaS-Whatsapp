# PLANO - TAREFA-001: Definição de Arquitetura e Stack Tecnológico

## Resumo

Este plano documenta todas as decisões arquiteturais e de stack tecnológico do CompraZap, um SaaS greenfield de planejamento de compras via WhatsApp + IA. Cada decisão foi pesquisada contra o estado da arte em fev/2026, avaliando alternativas com critérios concretos. O resultado são documentos executáveis que guiarão todo o desenvolvimento.

---

## Decisões Arquiteturais

### 1. Framework Backend: NestJS

- **Decisão:** NestJS com Fastify adapter (ao invés do Express padrão).
- **Justificativa:**
  - Estrutura modular com DI nativo — essencial para um SaaS com múltiplos módulos (WhatsApp, Gemini, Billing, etc.)
  - Ecossistema maduro: @nestjs/bullmq, @nestjs/config, @nestjs/swagger, guards, pipes, interceptors
  - O Fastify adapter dá ganho de ~2x em throughput vs Express, sem sacrificar o ecossistema NestJS
  - Decorators + TypeScript produzem código autodocumentado e fácil de onboardar novos devs
  - Comunidade grande, documentação excelente, amplamente adotado em produção SaaS
- **Alternativas descartadas:**
  - **Fastify puro:** Performance superior, mas sem DI, sem estrutura opinada, exigiria montar todo o scaffolding manualmente. Para um SaaS com 7+ módulos, a produtividade cairia significativamente.
  - **Hono:** Otimizado para edge/serverless, footprint mínimo. Inadequado para uma API stateful com BullMQ, Prisma, Redis, webhooks longos. Não tem ecossistema comparável para SaaS backend.

### 2. Framework Frontend: Next.js 15 (App Router)

- **Decisão:** Next.js 15 com App Router para landing page + dashboard admin no mesmo app.
- **Justificativa:**
  - App Router estável e production-ready, com React Server Components para performance
  - Route Groups `(landing)` e `(dashboard)` permitem separar contextos sem projetos distintos
  - SSR nativo para SEO da landing page; RSC para bundles menores no dashboard
  - Parallel Routes para seções independentes do dashboard
  - Server Actions eliminam boilerplate de API routes para mutations
  - Deploy otimizado no Vercel com zero-config
- **Alternativas descartadas:**
  - **Separar landing (Astro) + dashboard (Next.js):** Duplicação de infra, dois deploys, dois builds. A complexidade não se justifica para um MVP.
  - **Pages Router:** Legado; o ecossistema está migrando para App Router. Sem RSC, sem Server Actions.
  - **Remix/SvelteKit:** Frameworks competentes, mas ecossistema menor de componentes UI (shadcn/ui é exclusivo Next.js/React).

### 3. Monorepo: Turborepo

- **Decisão:** Turborepo com pnpm workspaces.
- **Justificativa:**
  - Setup mínimo: um `turbo.json` e pronto. Ideal para equipe pequena e projeto nascente
  - Cache local e remoto (Vercel Remote Cache) eficiente para 2-4 packages
  - Para o tamanho do CompraZap (~2 apps + 2 packages), a diferença de performance Nx vs Turbo é negligível
  - Integração nativa com Vercel (deploy do `apps/web` detecta automaticamente)
  - Daemon mais estável que o Nx em 2026
- **Alternativas descartadas:**
  - **Nx:** Superior em monorepos grandes (15+ apps), mas overhead de configuração desnecessário para nosso escopo. Plugins framework-specific adicionam complexidade sem benefício proporcional.
  - **Lerna:** Focado em publicação de pacotes npm, não em build orchestration. Não compete com Turbo/Nx para app monorepos.

### 4. ORM: Prisma 7

- **Decisão:** Prisma ORM v7 com driver adapter `@prisma/adapter-pg`.
- **Justificativa:**
  - Type-safety completo: schema gera tipos TypeScript que permeiam toda a API
  - Migrations declarativas com histórico versionado
  - Prisma Studio para debug/inspeção visual durante dev
  - prisma.config.ts (novo em v7) padroniza configuração
  - Excelente integração com NestJS via PrismaService
- **Nota:** Prisma v7 requer Node 20.19+ e TypeScript 5.4+. Usaremos Node 22 LTS e TS 5.9+.

### 5. Banco de Dados: Neon PostgreSQL

- **Decisão:** Neon como PostgreSQL gerenciado em produção.
- **Justificativa:**
  - Serverless com scale-to-zero — custo zero quando sem tráfego (ideal para MVP)
  - Branching instantâneo (copy-on-write) para preview environments e CI
  - Cold start ~5ms — imperceptível para o usuário
  - Integração nativa com Vercel (connection string automática por branch)
  - Pricing usage-based, previsível para início
- **Alternativas descartadas:**
  - **Supabase:** Backend-as-a-Service completo, mas traz auth, storage, realtime que não usaremos (já temos NestJS + Clerk/NextAuth). Pagar por serviços unused não faz sentido.
  - **AWS RDS:** Pricing fixo por instância, sem scale-to-zero, complexidade de VPC/Security Groups desnecessária para MVP.

### 6. Cache/Filas: Upstash Redis + BullMQ

- **Decisão:** Upstash Redis (plano Fixed) + BullMQ para filas de processamento.
- **Justificativa:**
  - Redis serverless com persistência, TLS nativo, REST API
  - BullMQ é o padrão de facto para filas em Node.js com suporte nativo a NestJS (@nestjs/bullmq)
  - Plano Fixed do Upstash (não Pay-As-You-Go) para evitar custos de polling do BullMQ
  - Casos de uso: sessões de conversa WhatsApp, fila de processamento de mensagens, rate limiting, cache de respostas da IA
- **Nota importante:** Configurar `stalledInterval: 300000` e `guardInterval: 300000` para otimizar consumo de requests.

### 7. WhatsApp: Meta Cloud API

- **Decisão:** Meta Cloud API (oficial) com Node.js SDK.
- **Justificativa:**
  - Única API oficial suportada desde out/2025 (On-Premises API foi deprecada)
  - Webhook nativo com validação via X-Hub-Signature-256
  - SDK oficial: `whatsapp` npm package
  - Suporte a texto, imagens, áudio, templates
- **Padrão de integração:** Queue-first — receber webhook → enfileirar no BullMQ → retornar HTTP 200 imediato → processar async. Evita timeouts e retry cascades.
- **Atenção:** Atualizar certificado mTLS até 31/03/2026 (mudança de CA da Meta).

### 8. IA: Google Gemini API (Gemini 3 Flash)

- **Decisão:** Gemini 3 Flash como modelo principal; Gemini 3 Pro como fallback para tarefas complexas.
- **Justificativa:**
  - Gemini 3 Flash: $0.50/1M input tokens, $3.00/1M output tokens — custo-benefício excelente para chat
  - Free tier disponível para desenvolvimento
  - SDK: @google/genai (experimental, suporta Gemini API e Vertex AI)
  - Multimodal: aceita texto, imagens, áudio (futuro: transcrição de áudio de WhatsApp)
  - Context caching para reduzir custos com system prompts repetidos
- **Alternativas descartadas:**
  - **OpenAI GPT-4o:** Mais caro por token, sem free tier comparável
  - **Claude:** Excelente em raciocínio, mas pricing menos competitivo para alto volume de chat

### 9. Billing: Stripe

- **Decisão:** Stripe para gestão de assinaturas e pagamentos.
- **Justificativa:**
  - Padrão de mercado para SaaS, documentação impecável
  - Customer Portal para self-service de assinaturas
  - Pricing Tables para no-code na landing page
  - Smart Retries + reminder emails para recuperação de receita
  - Webhooks robustos para sincronização com backend
- **Padrão de integração:** Webhook idempotente com tabela `webhook_events` + optimistic locking na tabela `subscriptions`.

### 10. Deploy: Railway (API) + Vercel (Frontend) + Neon (DB) + Upstash (Redis)

- **Decisão:** Deploy distribuído por responsabilidade.
- **Justificativa:**
  - **Railway para API:** Container Docker nativo, $5/mês hobby, ~$23/mês para tráfego médio. Suporta long-running processes (BullMQ workers), horizontal scaling, multi-service.
  - **Vercel para Frontend:** Zero-config para Next.js, edge functions, preview deploys automáticos por PR.
  - **Neon para DB:** Scale-to-zero, branching por PR, integração Vercel.
  - **Upstash para Redis:** Serverless, TLS, REST API, plano Fixed para BullMQ.
- **Alternativas descartadas:**
  - **Render:** Comparável ao Railway mas DX ligeiramente inferior em multi-service
  - **AWS ECS/Fargate:** Custo-benefício ruim para MVP, complexidade operacional alta
  - **Vercel para API:** Serverless functions com limite de 13.3min, incompatível com BullMQ workers e webhooks longos

### 11. Autenticação: Clerk (Dashboard) + WhatsApp number (Usuários)

- **Decisão:** Clerk para autenticação do dashboard admin; número de WhatsApp como identidade de usuários finais.
- **Justificativa:**
  - Clerk: auth completo (social, MFA, session management) com <100 linhas de código
  - Usuários finais se identificam pelo número de WhatsApp — zero fricção, sem login/senha
  - Middleware do Clerk protege rotas do dashboard; guards NestJS protegem API admin

### 12. Monitoramento: Sentry + Axiom

- **Decisão:** Sentry para error tracking + Axiom para logs e tracing.
- **Justificativa:**
  - **Sentry:** SDK nativo para Next.js (@sentry/nextjs) e NestJS. Captura erros, performance, tracing automático de Server Components e API routes.
  - **Axiom:** Logs estruturados com @axiomhq/nextjs, OpenTelemetry para tracing distribuído, Web Vitals tracking.
  - Combinação cobre: errors → Sentry, logs + metrics → Axiom.

### 13. CI/CD: GitHub Actions

- **Decisão:** GitHub Actions com Turborepo remote caching.
- **Justificativa:**
  - Integração nativa com GitHub (repo já estará lá)
  - Turbo remote cache acelera builds incrementais
  - Matrix de jobs para lint, test, build em paralelo
  - Deploy triggers: push to main (production), PR (preview)

### 14. Testes: Vitest + Playwright

- **Decisão:** Vitest para unit/integration tests; Playwright para E2E.
- **Justificativa:**
  - **Vitest:** Compatível com ESM nativo, watch mode rápido, API compatível com Jest, workspace support para monorepo
  - **Playwright:** Testa o stack completo (SSR + client hydration + API), tracing para debug, multi-browser
  - Estratégia: unit tests para business logic + E2E para fluxos críticos (auth, billing, chat)

---

## Etapas de Implementação

### Etapa 1: Criar docs/ARCHITECTURE.md

Documento de arquitetura técnica contendo:
- Diagrama de arquitetura atualizado com todos os serviços
- Stack tecnológico final com versões específicas
- Estrutura do monorepo detalhada
- Fluxo de dados: WhatsApp → API → Gemini → Resposta
- Padrões de comunicação entre módulos
- Estratégia de deploy e ambientes (dev, staging, prod)
- Requisitos de infraestrutura

### Etapa 2: Criar docs/CODING_STANDARDS.md

Documento de padrões de código contendo:
- Configuração ESLint 9 (flat config) + Prettier
- Configuração TypeScript strict mode
- Convenções de nomenclatura (files, variables, classes, interfaces)
- Estrutura de módulos NestJS
- Padrões de componentes React/Next.js
- Padrões de commit (Conventional Commits via Commitlint)
- Padrões de testes (nomenclatura, organização, coverage mínimo)
- Git workflow (trunk-based com feature branches)
- Husky + lint-staged setup

### Etapa 3: Criar ADRs

Architecture Decision Records para decisões críticas:

- **ADR-001:** Backend Framework — NestJS com Fastify adapter
- **ADR-002:** Estratégia de Deploy — Railway + Vercel + Neon + Upstash
- **ADR-003:** Banco de Dados — Neon PostgreSQL Serverless
- **ADR-004:** Integração WhatsApp — Meta Cloud API com Queue-First Pattern
- **ADR-005:** Motor de IA — Gemini 3 Flash com fallback Pro
- **ADR-006:** Monorepo — Turborepo com pnpm Workspaces

---

## Entregáveis

- [x] `docs/ARCHITECTURE.md` — Documento de arquitetura técnica completo
- [x] `docs/CODING_STANDARDS.md` — Padrões de código e desenvolvimento
- [x] `docs/ADR/ADR-001-backend-framework.md` — ADR: NestJS + Fastify
- [x] `docs/ADR/ADR-002-deploy-strategy.md` — ADR: Railway + Vercel + Neon + Upstash
- [x] `docs/ADR/ADR-003-database.md` — ADR: Neon PostgreSQL
- [x] `docs/ADR/ADR-004-whatsapp-integration.md` — ADR: Meta Cloud API + Queue-First
- [x] `docs/ADR/ADR-005-ai-engine.md` — ADR: Gemini 3 Flash
- [x] `docs/ADR/ADR-006-monorepo.md` — ADR: Turborepo + pnpm

## Estimativa

- **Tempo:** 3h (pesquisa já realizada, documentação em andamento)
- **Riscos:** Nenhum — tarefa puramente documental
- **Dependências:** Nenhuma — é a primeira tarefa do projeto
