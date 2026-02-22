# CompraZap

SaaS de planejamento de compras via WhatsApp com IA (Gemini). Consumidores planejam suas compras conversando com um assistente via WhatsApp.

## Pré-requisitos

- **Node.js 22** (LTS) — `node -v` deve retornar v22.x
- **pnpm 9+** — ative com `corepack enable` e `corepack prepare pnpm@latest --activate`, ou instale com `npm install -g pnpm`
- **Docker e Docker Compose** — para Postgres e Redis em desenvolvimento
- **Git**

## Setup

1. **Clone o repositório**
   ```bash
   git clone <repo-url>
   cd comprazap
   ```

2. **Instale dependências**
   ```bash
   corepack enable
   pnpm install
   ```

3. **Configure variáveis de ambiente**
   ```bash
   cp .env.example .env
   ```
   Preencha no mínimo `DATABASE_URL` e `REDIS_URL` para desenvolvimento local.

4. **Suba Postgres e Redis**
   ```bash
   docker compose up -d
   ```

5. **(Opcional) Migrations Prisma**
   ```bash
   pnpm --filter api exec prisma migrate dev
   ```

6. **Verifique**
   ```bash
   pnpm run build
   pnpm run dev
   ```

## Scripts principais

| Comando        | Descrição                    |
|----------------|------------------------------|
| `pnpm build`   | Build de todos os packages   |
| `pnpm dev`     | Modo desenvolvimento (turbo)|
| `pnpm lint`    | Lint em todo o monorepo      |
| `pnpm test`    | Testes (turbo)               |
| `pnpm format`  | Formatar com Prettier        |

Por app:

- `pnpm --filter api dev` — API NestJS em http://localhost:3000
- `pnpm --filter web dev` — Next.js em http://localhost:3001

## Estrutura do repositório

```
comprazap/
├── apps/
│   ├── api/          # Backend NestJS (Fastify) + Prisma
│   └── web/          # Frontend Next.js 15 (App Router)
├── packages/
│   ├── shared/       # Tipos, constantes, schemas Zod, utils
│   └── ui/           # Componentes UI base (React)
├── docs/             # Documentação e ADRs
├── .github/workflows/ # CI (GitHub Actions)
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md) — visão geral, stack e estrutura do monorepo
- [Padrões de código](docs/CODING_STANDARDS.md) — ESLint, Prettier, commits, testes
- [ADRs](docs/ADR/) — decisões de arquitetura
