# CompraZap - SaaS de Planejamento de Compras via WhatsApp + IA

## Visão Geral

SaaS que permite que consumidores finais conversem com uma Inteligência Artificial (Gemini) via WhatsApp para planejar suas compras de forma inteligente. O usuário envia mensagens para um número de WhatsApp e a IA ajuda a:

- Montar listas de compras organizadas
- Sugerir produtos com base em necessidades e orçamento
- Comparar opções e priorizar itens
- Criar planos de compras recorrentes (supermercado, casa, etc.)
- Dar dicas de economia e substituições inteligentes

---

## Público-Alvo

- **B2C direto**: Consumidores que querem organizar suas compras pessoais
- **B2B (futuro)**: Empresas que querem oferecer o serviço para seus clientes (white-label)

---

## Arquitetura de Alto Nível

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  WhatsApp   │────▶│   Backend API    │────▶│   Gemini API    │
│  (Usuário)  │◀────│   (Orquestrador) │◀────│   (IA)          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼──────┐
              │  Database  │ │  Redis    │
              │ (Postgres) │ │  (Cache/  │
              │            │ │  Session) │
              └────────────┘ └───────────┘
                    │
              ┌─────▼─────────────┐
              │  Admin Dashboard  │
              │  (Next.js)        │
              └───────────────────┘
```

---

## Stack Tecnológico (Proposta Inicial)

### Backend
| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Runtime | **Node.js + TypeScript** | Ecossistema rico, async nativo, ideal para I/O intensivo |
| Framework | **NestJS** | Estrutura robusta, DI nativo, modular, ótimo para SaaS |
| ORM | **Prisma** | Type-safe, migrations, boa DX |
| Banco | **PostgreSQL** | Robusto, JSON support, escalável |
| Cache/Sessão | **Redis** | Sessões de conversa, rate limiting, filas |
| Filas | **BullMQ** (Redis) | Processamento async de mensagens |
| WhatsApp | **Meta Cloud API** (oficial) | API oficial, confiável, webhook nativo |
| IA | **Google Gemini API** | Modelo multimodal, bom custo-benefício |

### Frontend (Dashboard Admin)
| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Framework | **Next.js 14+ (App Router)** | SSR, RSC, ótima DX |
| UI | **Tailwind CSS + shadcn/ui** | Rápido, consistente, componentes prontos |
| Auth | **NextAuth.js / Clerk** | Autenticação completa |
| Charts | **Recharts** | Dashboards de uso e métricas |

### Landing Page
| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Framework | **Next.js** (mesmo projeto) | Reutiliza stack, SEO nativo |
| Animações | **Framer Motion** | Animações elegantes |

### Infraestrutura
| Componente | Tecnologia | Justificativa |
|-----------|-----------|---------------|
| Deploy Backend | **Railway / Render / AWS ECS** | Simples para MVP, escalável depois |
| Deploy Frontend | **Vercel** | Deploy automático, edge functions |
| Banco Managed | **Supabase / Neon / RDS** | PostgreSQL gerenciado |
| Redis Managed | **Upstash / ElastiCache** | Redis serverless |
| Monitoramento | **Sentry + Axiom** | Errors + Logs |
| CI/CD | **GitHub Actions** | Automação de deploy |

---

## Modelo de Negócio

### Planos (Proposta)

| Plano | Preço/mês | Mensagens/mês | Features |
|-------|----------|---------------|----------|
| **Free** | R$ 0 | 50 mensagens | Lista básica, 1 perfil |
| **Básico** | R$ 19,90 | 500 mensagens | Listas ilimitadas, histórico 30d |
| **Pro** | R$ 49,90 | 2.000 mensagens | Listas compartilhadas, lembretes, histórico ilimitado |
| **Família** | R$ 79,90 | 5.000 mensagens | Até 5 membros, orçamento familiar |

### Monetização Futura
- White-label para supermercados/varejistas
- Integração com e-commerce (afiliados)
- API para desenvolvedores

---

## Módulos Principais

### 1. WhatsApp Gateway
- Receber/enviar mensagens via Meta Cloud API
- Webhook para receber mensagens em tempo real
- Gerenciar sessões de conversa
- Suporte a texto, imagens (listas), áudios (transcrição)
- Rate limiting por usuário

### 2. Motor de IA (Gemini)
- System prompt especializado em planejamento de compras
- Contexto de conversa persistente (memória)
- Processamento de intenções do usuário
- Geração de listas estruturadas
- Sugestões baseadas em histórico

### 3. Core de Negócio
- Gestão de listas de compras
- Perfis de usuário e preferências
- Orçamento e controle de gastos
- Categorização automática de produtos
- Lembretes e recorrências

### 4. Multi-tenancy e Auth
- Registro via WhatsApp (número = identidade)
- Planos e limites por usuário
- Rate limiting e controle de uso
- Autenticação admin (dashboard)

### 5. Billing
- Integração Stripe para cobranças
- Gerenciamento de assinaturas
- Controle de uso (mensagens consumidas)
- Webhooks de pagamento

### 6. Admin Dashboard
- Métricas de uso (MAU, mensagens, conversões)
- Gestão de usuários
- Monitoramento de conversas (quality)
- Configuração de prompts da IA
- Relatórios financeiros

### 7. Landing Page
- Página de conversão
- Demonstração interativa
- Pricing
- FAQ e documentação

---

## Fluxo Principal do Usuário

```
1. Usuário descobre o serviço (landing page, indicação, anúncio)
2. Escaneia QR Code ou clica no link do WhatsApp
3. Envia "Oi" para o número
4. IA se apresenta e pergunta como pode ajudar
5. Usuário diz: "Quero montar minha lista de supermercado"
6. IA faz perguntas: quantas pessoas, orçamento, preferências
7. IA gera lista organizada por seção do mercado
8. Usuário pode ajustar: "tira o refrigerante, add suco"
9. IA atualiza e envia lista final formatada
10. Usuário pode pedir: "me lembra de comprar isso toda semana"
```

---

## Fases de Desenvolvimento

### Fase 1 - MVP (4-6 semanas)
- [ ] Setup do projeto (monorepo, configs)
- [ ] Backend core com NestJS
- [ ] Integração WhatsApp (enviar/receber)
- [ ] Integração Gemini (conversa básica)
- [ ] Banco de dados (usuários, conversas, listas)
- [ ] Fluxo completo: usuário → WhatsApp → IA → resposta
- [ ] Landing page básica
- [ ] Deploy em staging

### Fase 2 - Produto (3-4 semanas)
- [ ] Listas de compras estruturadas
- [ ] Memória de conversa / contexto
- [ ] Perfis e preferências do usuário
- [ ] Rate limiting e controle de uso
- [ ] Dashboard admin básico
- [ ] Sistema de planos (free/pago)

### Fase 3 - Monetização (2-3 semanas)
- [ ] Integração Stripe
- [ ] Controle de assinaturas
- [ ] Limites por plano
- [ ] Landing page completa com pricing

### Fase 4 - Escala (contínuo)
- [ ] Otimização de prompts
- [ ] Suporte a áudio/imagem
- [ ] Listas compartilhadas
- [ ] Lembretes e recorrências
- [ ] White-label
- [ ] API pública

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Custo Gemini API alto | Alto | Rate limiting agressivo, cache de respostas similares, plano free limitado |
| WhatsApp Business approval | Alto | Aplicar cedo, ter fallback (Telegram) |
| Latência de resposta | Médio | Streaming, mensagem "digitando...", cache Redis |
| Abuso do serviço | Médio | Rate limiting, detecção de spam, bloqueio |
| Concorrência | Médio | Focar em UX e nicho (compras), iterar rápido |

---

## Estrutura do Monorepo (Proposta)

```
comprazap/
├── apps/
│   ├── api/                  # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── whatsapp/     # Gateway WhatsApp
│   │   │   │   ├── gemini/       # Integração IA
│   │   │   │   ├── chat/         # Orquestração de conversa
│   │   │   │   ├── shopping/     # Core de listas/compras
│   │   │   │   ├── users/        # Gestão de usuários
│   │   │   │   ├── billing/      # Stripe/assinaturas
│   │   │   │   └── admin/        # Endpoints do dashboard
│   │   │   ├── common/           # Guards, filters, pipes
│   │   │   └── config/           # Configurações
│   │   └── prisma/               # Schema + migrations
│   │
│   └── web/                  # Frontend Next.js
│       ├── app/
│       │   ├── (landing)/        # Landing page pública
│       │   ├── (dashboard)/      # Dashboard admin
│       │   └── api/              # API routes (auth, etc.)
│       └── components/
│
├── packages/
│   ├── shared/               # Types, utils compartilhados
│   └── ui/                   # Componentes UI compartilhados
│
├── docs/                     # Documentação do projeto
├── docker-compose.yml        # Dev environment
├── turbo.json                # Turborepo config
└── package.json              # Root workspace
```

---

*Documento criado em: 20/02/2026*
*Versão: 1.0 - Visão Geral Inicial*
