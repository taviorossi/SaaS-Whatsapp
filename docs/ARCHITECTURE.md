# CompraZap — Arquitetura Técnica

> Versão: 1.0 | Data: 20/02/2026 | Status: Aprovação Pendente

---

## 1. Visão Geral

CompraZap é um SaaS B2C que permite consumidores planejarem suas compras conversando com uma IA via WhatsApp. A arquitetura segue um modelo de API monolítica modular (NestJS) orquestrando integrações externas (WhatsApp, Gemini, Stripe), com frontend Next.js servindo landing page e dashboard admin.

---

## 2. Diagrama de Arquitetura

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INTERNET                                   │
└────────┬──────────────┬──────────────┬──────────────┬────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌────────────┐  ┌──────────────┐  ┌────────┐  ┌───────────┐
│  WhatsApp  │  │   Browser    │  │ Stripe │  │  GitHub   │
│  (Usuário) │  │  (Admin/LP)  │  │Webhooks│  │  Actions  │
└─────┬──────┘  └──────┬───────┘  └───┬────┘  └─────┬─────┘
      │                │              │              │
      │ Webhooks       │ HTTPS        │ Webhooks     │ CI/CD
      ▼                ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   NestJS API (Fastify)                     │  │
│  │                                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ WhatsApp │ │  Gemini  │ │ Billing  │ │    Admin    │  │  │
│  │  │ Module   │ │  Module  │ │ Module   │ │   Module    │  │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │  │
│  │       │             │            │              │          │  │
│  │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌─────▼──────┐  │  │
│  │  │   Chat   │ │ Shopping │ │  Users   │ │   Auth     │  │  │
│  │  │ Module   │ │  Module  │ │ Module   │ │  (Clerk)   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            Common Layer                              │  │  │
│  │  │  Guards | Filters | Pipes | Interceptors | Config   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │          │                             │
│  ┌──────────────────────▼──────────▼──────────────────────────┐ │
│  │                  BullMQ Workers                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │ │
│  │  │ Message      │  │ AI Response  │  │ Notification     │ │ │
│  │  │ Processor    │  │ Processor    │  │ Processor        │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────┬───────────────────────────┘
              │                      │
              ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│     Neon PostgreSQL  │  │   Upstash Redis      │
│     (Database)       │  │   (Cache + Queues)   │
│                      │  │                      │
│  • Users             │  │  • Session store     │
│  • Conversations     │  │  • BullMQ queues     │
│  • Shopping lists    │  │  • Rate limiting     │
│  • Subscriptions     │  │  • AI response cache │
│  • Webhook events    │  │                      │
└──────────────────────┘  └──────────────────────┘

         ┌──────────────────────────────────────────┐
         │              VERCEL                       │
         │  ┌────────────────────────────────────┐  │
         │  │        Next.js 15 (App Router)      │  │
         │  │                                     │  │
         │  │  ┌─────────────┐ ┌──────────────┐  │  │
         │  │  │  (landing)  │ │ (dashboard)  │  │  │
         │  │  │  Route Grp  │ │  Route Grp   │  │  │
         │  │  │             │ │              │  │  │
         │  │  │ • Home      │ │ • Overview   │  │  │
         │  │  │ • Pricing   │ │ • Users      │  │  │
         │  │  │ • FAQ       │ │ • Convos     │  │  │
         │  │  │ • Contact   │ │ • Billing    │  │  │
         │  │  └─────────────┘ │ • Settings   │  │  │
         │  │                  └──────────────┘  │  │
         │  └────────────────────────────────────┘  │
         └──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Meta     │  │  Google  │  │  Stripe  │           │
│  │  Cloud    │  │  Gemini  │  │  Billing │           │
│  │  API      │  │  API     │  │  API     │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Clerk   │  │  Sentry  │  │  Axiom   │           │
│  │  Auth    │  │  Errors  │  │  Logs    │           │
│  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológico Final

### 3.1 Backend

| Componente | Tecnologia | Versão | Justificativa |
|-----------|-----------|--------|---------------|
| Runtime | Node.js | 22 LTS | Suporte LTS até 2027, requerido pelo Prisma 7 |
| Linguagem | TypeScript | 5.9+ | Strict mode, satisfies, const type params |
| Framework | NestJS + Fastify adapter | 11+ | Modular, DI, ~2x throughput vs Express |
| ORM | Prisma | 7 | Type-safe, prisma.config.ts, driver adapters |
| DB driver | @prisma/adapter-pg | latest | Requerido pelo Prisma 7 |
| Banco | PostgreSQL | 16+ | Via Neon serverless |
| Cache | Redis | 7+ | Via Upstash, TLS nativo |
| Filas | BullMQ + @nestjs/bullmq | latest | Processamento async de mensagens |
| WhatsApp | Meta Cloud API + SDK | v16.0+ | API oficial, webhook nativo |
| IA | Google Gemini API | 3 Flash/Pro | @google/genai SDK |
| Billing | Stripe | latest | stripe npm package |
| Validação | class-validator + class-transformer | latest | Integração nativa NestJS |
| API Docs | @nestjs/swagger | latest | OpenAPI 3.0 automático |

### 3.2 Frontend

| Componente | Tecnologia | Versão | Justificativa |
|-----------|-----------|--------|---------------|
| Framework | Next.js (App Router) | 15+ | RSC, Server Actions, streaming |
| UI Library | Tailwind CSS | 4+ | Utility-first, tree-shaking nativo |
| Componentes | shadcn/ui | latest | Componentes acessíveis, copy-paste |
| Auth | Clerk | latest | @clerk/nextjs, middleware, SSR |
| Charts | Recharts | latest | Dashboard de métricas |
| Animações | Framer Motion | latest | Landing page animations |
| Forms | React Hook Form + Zod | latest | Validação type-safe |
| State | Zustand | latest | Client state leve (quando necessário) |
| Data Fetching | TanStack Query | 5+ | Cache, revalidation, optimistic updates |

### 3.3 Shared Packages

| Package | Conteúdo |
|---------|----------|
| `@comprazap/shared` | Types TypeScript, constantes, utils, Zod schemas compartilhados |
| `@comprazap/ui` | Componentes UI base (wrappers shadcn/ui customizados) |

### 3.4 Infraestrutura

| Componente | Serviço | Plano Inicial | Custo Estimado |
|-----------|---------|---------------|----------------|
| API Backend | Railway | Pro ($20/mês base) | ~$25-40/mês |
| Frontend | Vercel | Pro ($20/mês) | ~$20/mês |
| Database | Neon PostgreSQL | Free → Launch | $0-19/mês |
| Redis | Upstash | Fixed ($10/mês) | $10/mês |
| Auth | Clerk | Free (10k MAU) | $0 |
| Error Tracking | Sentry | Developer (free) | $0 |
| Logs | Axiom | Free (500GB ingest) | $0 |
| CI/CD | GitHub Actions | Free (2000 min/mês) | $0 |
| **Total MVP** | | | **~$55-90/mês** |

### 3.5 Dev Tools

| Ferramenta | Uso |
|-----------|-----|
| pnpm | Package manager (workspaces) |
| Turborepo | Build orchestration + caching |
| ESLint 9 | Lint (flat config) |
| Prettier | Formatação |
| Husky | Git hooks |
| lint-staged | Lint em staged files |
| Commitlint | Conventional commits |
| Vitest | Unit + integration tests |
| Playwright | E2E tests |
| Docker Compose | Dev environment (Postgres + Redis local) |

---

## 4. Estrutura do Monorepo

```
comprazap/
├── apps/
│   ├── api/                        # Backend NestJS
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── modules/
│   │   │   │   ├── whatsapp/       # Gateway WhatsApp
│   │   │   │   │   ├── whatsapp.module.ts
│   │   │   │   │   ├── whatsapp.controller.ts
│   │   │   │   │   ├── whatsapp.service.ts
│   │   │   │   │   ├── whatsapp.processor.ts    # BullMQ worker
│   │   │   │   │   └── dto/
│   │   │   │   ├── gemini/         # Integração IA
│   │   │   │   │   ├── gemini.module.ts
│   │   │   │   │   ├── gemini.service.ts
│   │   │   │   │   └── prompts/    # System prompts versionados
│   │   │   │   ├── chat/           # Orquestração de conversa
│   │   │   │   │   ├── chat.module.ts
│   │   │   │   │   ├── chat.service.ts
│   │   │   │   │   └── chat.gateway.ts
│   │   │   │   ├── shopping/       # Core: listas de compras
│   │   │   │   │   ├── shopping.module.ts
│   │   │   │   │   ├── shopping.service.ts
│   │   │   │   │   ├── shopping.controller.ts
│   │   │   │   │   └── entities/
│   │   │   │   ├── users/          # Gestão de usuários
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   └── users.controller.ts
│   │   │   │   ├── billing/        # Stripe/assinaturas
│   │   │   │   │   ├── billing.module.ts
│   │   │   │   │   ├── billing.service.ts
│   │   │   │   │   ├── billing.controller.ts
│   │   │   │   │   └── stripe-webhook.controller.ts
│   │   │   │   └── admin/          # Endpoints do dashboard
│   │   │   │       ├── admin.module.ts
│   │   │   │       └── admin.controller.ts
│   │   │   ├── common/             # Cross-cutting concerns
│   │   │   │   ├── guards/
│   │   │   │   │   ├── clerk-auth.guard.ts
│   │   │   │   │   └── rate-limit.guard.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── all-exceptions.filter.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── logging.interceptor.ts
│   │   │   │   ├── pipes/
│   │   │   │   │   └── zod-validation.pipe.ts
│   │   │   │   └── decorators/
│   │   │   └── config/
│   │   │       ├── app.config.ts
│   │   │       ├── database.config.ts
│   │   │       └── redis.config.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── prisma.config.ts
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   └── e2e/
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── package.json
│   │
│   └── web/                        # Frontend Next.js
│       ├── app/
│       │   ├── layout.tsx          # Root layout
│       │   ├── (landing)/          # Landing page (público)
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx        # Home
│       │   │   ├── pricing/
│       │   │   │   └── page.tsx
│       │   │   └── faq/
│       │   │       └── page.tsx
│       │   ├── (dashboard)/        # Dashboard admin (autenticado)
│       │   │   ├── layout.tsx      # Sidebar + nav
│       │   │   ├── overview/
│       │   │   │   └── page.tsx
│       │   │   ├── users/
│       │   │   │   └── page.tsx
│       │   │   ├── conversations/
│       │   │   │   └── page.tsx
│       │   │   ├── billing/
│       │   │   │   └── page.tsx
│       │   │   └── settings/
│       │   │       └── page.tsx
│       │   ├── sign-in/[[...sign-in]]/
│       │   │   └── page.tsx
│       │   └── sign-up/[[...sign-up]]/
│       │       └── page.tsx
│       ├── components/
│       │   ├── landing/
│       │   ├── dashboard/
│       │   └── shared/
│       ├── lib/
│       │   ├── api-client.ts
│       │   ├── axiom/
│       │   └── utils.ts
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── package.json
│
├── packages/
│   ├── shared/                     # Código compartilhado
│   │   ├── src/
│   │   │   ├── types/              # Interfaces e types
│   │   │   │   ├── user.ts
│   │   │   │   ├── conversation.ts
│   │   │   │   ├── shopping-list.ts
│   │   │   │   └── subscription.ts
│   │   │   ├── constants/          # Enums, constantes
│   │   │   │   ├── plans.ts
│   │   │   │   └── limits.ts
│   │   │   ├── schemas/            # Zod schemas
│   │   │   │   └── index.ts
│   │   │   └── utils/              # Funções utilitárias
│   │   │       └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── ui/                         # Componentes UI base
│       ├── src/
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── card.tsx
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── VISAO_GERAL.md
│   ├── ARCHITECTURE.md             # Este documento
│   ├── CODING_STANDARDS.md
│   ├── ADR/
│   └── tarefas-pendentes/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Lint + Test + Build
│       └── deploy.yml              # Deploy production
│
├── docker-compose.yml              # Postgres + Redis para dev
├── turbo.json                      # Turborepo pipelines
├── pnpm-workspace.yaml             # Workspace config
├── package.json                    # Root package
├── .eslintrc.config.mjs            # ESLint flat config (root)
├── .prettierrc                     # Prettier config
├── .commitlintrc.json              # Commitlint config
├── .husky/                         # Git hooks
│   ├── pre-commit
│   └── commit-msg
├── .env.example                    # Template de variáveis
├── .gitignore
└── README.md
```

---

## 5. Fluxo de Dados Principal

### 5.1 Fluxo de Mensagem WhatsApp → IA → Resposta

```
1. Usuário envia mensagem no WhatsApp
      │
      ▼
2. Meta Cloud API envia webhook POST para /api/whatsapp/webhook
      │
      ▼
3. WhatsApp Controller:
   a. Valida X-Hub-Signature-256
   b. Retorna HTTP 200 imediatamente
   c. Enfileira mensagem no BullMQ (queue: "messages")
      │
      ▼
4. Message Processor (BullMQ Worker):
   a. Busca/cria usuário no DB pelo phone number
   b. Verifica limites do plano (rate limiting via Redis)
   c. Carrega contexto da conversa (últimas N mensagens do DB + cache Redis)
   d. Envia para Chat Service
      │
      ▼
5. Chat Service:
   a. Monta prompt: system prompt + contexto + mensagem do usuário
   b. Chama Gemini API (Flash para conversas normais, Pro para análises complexas)
   c. Parseia resposta estruturada da IA
   d. Persiste mensagem + resposta no DB
   e. Atualiza cache de sessão no Redis
      │
      ▼
6. WhatsApp Service:
   a. Formata resposta para WhatsApp (markdown → WhatsApp formatting)
   b. Envia via Meta Cloud API
   c. Registra status de envio
```

### 5.2 Fluxo de Billing

```
1. Usuário acessa pricing na landing page
      │
      ▼
2. Stripe Checkout Session criada via API
      │
      ▼
3. Usuário completa pagamento no Stripe
      │
      ▼
4. Stripe envia webhook para /api/billing/webhook
      │
      ▼
5. Billing Controller:
   a. Valida assinatura do webhook (Stripe SDK)
   b. Verifica idempotência (tabela webhook_events)
   c. Processa evento em transação atômica:
      - Atualiza subscription no DB
      - Ajusta limites do usuário no Redis
      - Marca webhook como processed
```

---

## 6. Padrões de Comunicação

### 6.1 API → Frontend

- **REST API** com endpoints documentados via Swagger/OpenAPI
- **Autenticação:** Clerk JWT tokens validados por guard NestJS
- **Versionamento:** Prefixo `/api/v1/` desde o início

### 6.2 Comunicação entre Módulos (Backend)

- **Síncrono:** Injeção de dependência NestJS (service-to-service)
- **Assíncrono:** BullMQ queues para operações demoradas ou que podem falhar
- **Eventos:** NestJS EventEmitter para side-effects (ex: nova mensagem → atualizar métricas)

### 6.3 Serviços Externos

| Serviço | Protocolo | Padrão de Resiliência |
|---------|-----------|----------------------|
| Meta Cloud API | REST + Webhooks | Retry com exponential backoff, DLQ |
| Gemini API | REST | Retry, fallback Flash → Pro, cache de respostas similares |
| Stripe | REST + Webhooks | Idempotência, optimistic locking, webhook replay |
| Clerk | REST + JWT | Token refresh automático, middleware verification |

---

## 7. Ambientes

| Ambiente | API | Frontend | Database | Redis |
|----------|-----|----------|----------|-------|
| **Local** | localhost:3000 | localhost:3001 | Docker Compose (Postgres) | Docker Compose (Redis) |
| **Preview** | Railway (PR branch) | Vercel (PR preview) | Neon (branch) | Upstash (dev) |
| **Staging** | Railway (staging) | Vercel (staging) | Neon (staging branch) | Upstash (staging) |
| **Production** | Railway (main) | Vercel (main) | Neon (main) | Upstash (production) |

---

## 8. Segurança

### 8.1 Princípios

- **Defense in depth:** Autenticação verificada em múltiplas camadas (middleware + guards + service)
- **Secrets management:** Variáveis de ambiente, nunca hardcoded. `.env.example` como template.
- **HTTPS everywhere:** TLS em todas as comunicações externas
- **Input validation:** class-validator + Zod schemas em toda entrada de dados

### 8.2 Medidas Específicas

| Vetor | Proteção |
|-------|----------|
| WhatsApp webhooks | Validação X-Hub-Signature-256 com constant-time comparison |
| Stripe webhooks | Validação via stripe.webhooks.constructEvent() |
| API endpoints admin | Clerk JWT + role-based guards |
| Rate limiting | Redis-based rate limiting por phone number e por IP |
| SQL injection | Prisma (queries parametrizadas por design) |
| XSS | React (escape automático) + CSP headers |
| CSRF | SameSite cookies + Clerk CSRF protection |

---

## 9. Observabilidade

### 9.1 Métricas Chave

| Métrica | Ferramenta | Threshold |
|---------|-----------|-----------|
| Error rate | Sentry | < 1% de requests |
| P95 latency (API) | Axiom | < 500ms |
| P95 latency (IA response) | Axiom | < 3s |
| Queue depth (BullMQ) | Axiom custom metrics | < 100 jobs pendentes |
| DB connection pool | Prisma metrics | < 80% utilização |

### 9.2 Alertas

- Sentry: Notificação Slack para novos erros e spikes
- Axiom: Alerta quando P95 > 1s ou error rate > 5%
- Upstash: Alerta de memória > 80%
- Railway: Alerta de CPU > 80% sustentado por 5min

---

## 10. Escalabilidade

### 10.1 Gargalos Esperados e Mitigações

| Gargalo | Mitigação |
|---------|-----------|
| Gemini API latência | Cache de respostas similares, streaming, queue-based processing |
| DB connections | Connection pooling via Prisma, Neon auto-scaling |
| WhatsApp webhook volume | BullMQ distribui processamento, Railway horizontal scaling |
| Redis memory | TTL em todas as chaves, eviction policy allkeys-lru |

### 10.2 Plano de Escala

1. **MVP (0-1k usuários):** Single Railway instance, Neon free, Upstash free
2. **Growth (1k-10k):** Railway Pro com 2 replicas, Neon Launch, Upstash Fixed
3. **Scale (10k+):** Railway horizontal scaling, Neon Scale, avaliar migração parcial para AWS

---

*Documento criado em: 20/02/2026*
*Próxima revisão: Após aprovação da TAREFA-001*
