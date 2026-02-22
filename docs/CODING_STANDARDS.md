# CompraZap — Padrões de Código e Desenvolvimento

> Versão: 1.0 | Data: 20/02/2026

---

## 1. Linguagem e Runtime

| Item | Padrão |
|------|--------|
| Runtime | Node.js 22 LTS |
| Linguagem | TypeScript 5.9+ |
| Module system | ESM (`"type": "module"` em todos os package.json) |
| Strict mode | `"strict": true` no tsconfig.json |
| Target | ES2023 |

### TypeScript Rules

- `strict: true` obrigatório (inclui strictNullChecks, noImplicitAny, etc.)
- `noUncheckedIndexedAccess: true` — acesso a arrays/objetos retorna `T | undefined`
- `exactOptionalPropertyTypes: true` — diferencia `undefined` de propriedade ausente
- Nunca usar `any`. Usar `unknown` quando o tipo é realmente desconhecido, e fazer type narrowing.
- Preferir `interface` para objetos que serão implementados/estendidos; `type` para unions, intersections e aliases.

---

## 2. Formatação e Linting

### 2.1 ESLint 9 (Flat Config)

Arquivo raiz: `eslint.config.mjs`

Configuração base:
- `@typescript-eslint/parser` com project references
- `@typescript-eslint/eslint-plugin` (regras recomendadas + strict)
- `eslint-config-prettier` (desabilita regras de formatação)
- `eslint-plugin-prettier` (roda Prettier como regra ESLint)
- `@vercel/style-guide` como base

Regras customizadas importantes:
- `no-console`: warn (usar logger injetado em produção)
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/explicit-function-return-type`: warn (exceto em componentes React)
- `@typescript-eslint/no-unused-vars`: error (com `argsIgnorePattern: "^_"`)
- `import/order`: ordenação automática de imports

### 2.2 Prettier

Arquivo: `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 2.3 EditorConfig

Arquivo: `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

---

## 3. Convenções de Nomenclatura

### 3.1 Arquivos e Diretórios

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Diretórios | kebab-case | `shopping-list/` |
| Módulos NestJS | kebab-case + sufixo | `whatsapp.module.ts` |
| Services NestJS | kebab-case + sufixo | `whatsapp.service.ts` |
| Controllers NestJS | kebab-case + sufixo | `whatsapp.controller.ts` |
| DTOs | kebab-case + sufixo | `create-list.dto.ts` |
| Componentes React | PascalCase | `ShoppingList.tsx` |
| Hooks React | camelCase com "use" | `useShoppingList.ts` |
| Utils/Helpers | kebab-case | `format-currency.ts` |
| Tipos/Interfaces | kebab-case | `shopping-list.ts` |
| Testes | mesmo nome + `.spec.ts` | `whatsapp.service.spec.ts` |
| Testes E2E | mesmo nome + `.e2e-spec.ts` | `auth.e2e-spec.ts` |

### 3.2 Código

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Classes | PascalCase | `WhatsappService` |
| Interfaces | PascalCase (sem prefixo I) | `ShoppingList` |
| Types | PascalCase | `CreateListInput` |
| Enums | PascalCase (valores UPPER_SNAKE) | `PlanType.FREE_TIER` |
| Variáveis | camelCase | `shoppingList` |
| Constantes | UPPER_SNAKE_CASE | `MAX_MESSAGES_FREE` |
| Funções | camelCase | `calculateTotal()` |
| Métodos privados | camelCase (sem prefixo _) | `parseWebhook()` |
| Boolean vars | prefixo is/has/should/can | `isActive`, `hasSubscription` |
| Handlers de evento | prefixo handle/on | `handleMessage()`, `onPaymentSuccess()` |

### 3.3 Banco de Dados (Prisma)

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Tabelas | PascalCase (singular) | `model User` |
| Colunas | camelCase | `phoneNumber` |
| Relações | camelCase | `shoppingLists` |
| Enums | PascalCase | `enum SubscriptionStatus` |
| Índices | descritivos | `@@index([userId, createdAt])` |
| Migration names | descritivas | `20260220_add_shopping_lists` |

---

## 4. Estrutura de Módulos NestJS

Cada módulo deve seguir esta estrutura:

```
modules/
└── whatsapp/
    ├── whatsapp.module.ts          # Registro de providers, imports, exports
    ├── whatsapp.controller.ts      # HTTP endpoints (thin layer)
    ├── whatsapp.service.ts         # Business logic principal
    ├── whatsapp.processor.ts       # BullMQ worker (se aplicável)
    ├── whatsapp.service.spec.ts    # Unit tests
    ├── dto/                        # Data Transfer Objects
    │   ├── send-message.dto.ts
    │   └── webhook-payload.dto.ts
    ├── entities/                   # Prisma-related types (se necessário)
    └── constants.ts                # Constantes do módulo
```

### Regras de Módulo

- Controllers são finos: validam input, chamam service, retornam output. Sem business logic.
- Services contêm business logic. Um service pode injetar outros services.
- DTOs validam input (class-validator) na entrada. Retorno usa interfaces do `@comprazap/shared`.
- Cada módulo exporta apenas o que outros módulos precisam (princípio de encapsulamento).
- Imports circulares são proibidos. Usar `forwardRef()` apenas como último recurso documentado.

---

## 5. Padrões de Componentes React/Next.js

### 5.1 Estrutura de Componentes

```tsx
'use client'; // apenas se necessário (useState, useEffect, event handlers)

import { type ComponentProps } from 'react';

interface ShoppingListProps {
  items: ShoppingItem[];
  onRemove: (id: string) => void;
}

export function ShoppingList({ items, onRemove }: ShoppingListProps) {
  // hooks primeiro
  // derived state
  // handlers
  // render
}
```

### 5.2 Regras

- **Server Components por padrão.** Usar `'use client'` somente quando necessário.
- **Named exports** em todos os componentes (não usar `export default`, exceto em `page.tsx` e `layout.tsx` onde Next.js exige).
- **Props com interface** nomeada `{ComponentName}Props`.
- **Sem prop drilling** além de 2 níveis. Usar composition pattern ou context.
- **Colocação:** Componentes específicos de uma rota ficam junto da rota. Componentes reutilizáveis ficam em `components/shared/` ou no package `@comprazap/ui`.

### 5.3 Data Fetching

- Server Components fazem fetch direto (async components)
- Client Components usam TanStack Query para data fetching
- Mutations via Server Actions (forms) ou TanStack Query mutations (interações JS)
- Suspense boundaries em toda data fetch assíncrona

---

## 6. Git Workflow

### 6.1 Branching Strategy

Trunk-based development com feature branches curtas:

```
main (produção)
  └── feat/TAREFA-XXX-descricao    # feature branches
  └── fix/TAREFA-XXX-descricao     # bug fixes
  └── chore/descricao              # manutenção
```

- Feature branches vivem no máximo 2-3 dias
- PRs requerem pelo menos review de 1 pessoa (ou auto-merge para solo dev no MVP)
- Squash merge para main (histórico limpo)

### 6.2 Conventional Commits (Commitlint)

Formato: `type(scope): description`

| Type | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação (não altera lógica) |
| `refactor` | Refatoração (não altera funcionalidade) |
| `perf` | Melhoria de performance |
| `test` | Adição/correção de testes |
| `chore` | Manutenção (deps, configs, CI) |
| `ci` | Mudanças em CI/CD |

Scopes válidos: `api`, `web`, `shared`, `ui`, `infra`, `docs`

Exemplos:
```
feat(api): add WhatsApp webhook endpoint
fix(web): correct pricing display for family plan
chore(infra): update Docker Compose to PostgreSQL 16
test(api): add unit tests for chat service
```

### 6.3 Husky + lint-staged

**Pre-commit hook** (`.husky/pre-commit`):
```bash
pnpm lint-staged
```

**lint-staged config** (`.lintstagedrc.mjs`):
```javascript
export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.prisma': ['prettier --write'],
};
```

**Commit-msg hook** (`.husky/commit-msg`):
```bash
pnpm commitlint --edit $1
```

---

## 7. Estratégia de Testes

### 7.1 Pirâmide de Testes

```
        ╱╲
       ╱E2E╲          Playwright: fluxos críticos (auth, billing, chat)
      ╱──────╲
     ╱Integration╲    Vitest: módulos com DB/Redis (test containers)
    ╱──────────────╲
   ╱   Unit Tests    ╲  Vitest: services, utils, pure functions
  ╱────────────────────╲
```

### 7.2 Vitest (Unit + Integration)

- Arquivo de config por app: `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`
- Workspace config na raiz: `vitest.workspace.ts`
- Naming: `*.spec.ts` (unit), `*.integration-spec.ts` (integration)
- Coverage mínimo: 70% para services de business logic, 50% global
- Mocks: usar `vi.mock()` para dependências externas. Não mockar prisma em integration tests — usar test database.

### 7.3 Playwright (E2E)

- Package dedicado: `packages/e2e-tests/`
- Testa fluxos completos contra ambiente de staging/preview
- Cenários obrigatórios:
  - Login/logout no dashboard
  - Visualização de métricas
  - Fluxo de upgrade de plano
- `webServer` configurado para levantar Next.js automaticamente em CI
- Tracing habilitado em `on-first-retry` para debug

### 7.4 Testes de API (NestJS)

- Usar `@nestjs/testing` com `Test.createTestingModule()` para unit tests
- E2E da API com `supertest` + database real (test container PostgreSQL)
- Seed data consistente para testes reproduzíveis

---

## 8. Variáveis de Ambiente

### 8.1 Estrutura

Arquivo `.env.example` na raiz com todas as variáveis documentadas:

```bash
# ─── App ────────────────────────────────
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# ─── Database (Neon) ────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/comprazap

# ─── Redis (Upstash) ────────────────────
REDIS_URL=rediss://default:token@host:6379

# ─── WhatsApp (Meta Cloud API) ──────────
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WEBHOOK_VERIFY_TOKEN=
WA_API_VERSION=v21.0

# ─── Gemini API ─────────────────────────
GEMINI_API_KEY=
GEMINI_MODEL_FLASH=gemini-3-flash-preview
GEMINI_MODEL_PRO=gemini-3-pro-preview

# ─── Stripe ─────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

# ─── Clerk ──────────────────────────────
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=

# ─── Sentry ─────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# ─── Axiom ──────────────────────────────
AXIOM_TOKEN=
AXIOM_DATASET=comprazap
```

### 8.2 Regras

- **Nunca** commitar `.env`. Apenas `.env.example` vai para o repo.
- Prefixo `NEXT_PUBLIC_` para variáveis expostas ao browser (Next.js).
- Validar todas as variáveis no startup da aplicação (NestJS ConfigModule com Zod schema).
- Ambientes diferentes (dev, staging, prod) usam variáveis diferentes configuradas na plataforma de deploy.

---

## 9. Error Handling

### 9.1 Backend (NestJS)

- Global exception filter para capturar todas as exceções não tratadas
- Exceções de negócio estendem classes NestJS (`NotFoundException`, `ForbiddenException`, etc.)
- Erros de serviços externos (Gemini, WhatsApp, Stripe) são wrapped em exceções de domínio
- Logging estruturado: `{ level, message, context, userId, traceId }`
- Sentry captura automaticamente via interceptor

### 9.2 Frontend (Next.js)

- `error.tsx` em cada route group para error boundaries granulares
- `not-found.tsx` para 404 customizado
- `loading.tsx` para Suspense fallbacks
- TanStack Query `onError` para feedback ao usuário em mutations
- Sentry `ErrorBoundary` component para captura client-side

---

## 10. Performance

### 10.1 Backend

- Connection pooling Prisma: pool_size adequado ao tier do Neon
- Redis caching com TTL explícito em toda chave
- BullMQ: jobs com timeout, retry com backoff exponencial, DLQ para falhas persistentes
- Compressão gzip/brotli via Fastify
- Paginação cursor-based para listagens (não offset-based)

### 10.2 Frontend

- React Server Components por padrão (zero JS no client)
- Dynamic imports para componentes pesados (`next/dynamic`)
- Image optimization via `next/image`
- Font optimization via `next/font`
- Route prefetching automático do Next.js
- Suspense streaming para carregamento progressivo

---

## 11. Imports

### 11.1 Ordem de Imports

```typescript
// 1. Node.js built-ins
import { readFile } from 'node:fs/promises';

// 2. External dependencies
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// 3. Internal packages (@comprazap/*)
import { ShoppingList } from '@comprazap/shared';

// 4. Internal modules (relative paths)
import { WhatsappService } from '../whatsapp/whatsapp.service';

// 5. Local files
import { CreateListDto } from './dto/create-list.dto';
```

Aplicado automaticamente via ESLint `import/order`.

### 11.2 Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@comprazap/shared": ["../../packages/shared/src"],
      "@comprazap/ui": ["../../packages/ui/src"]
    }
  }
}
```

---

*Documento criado em: 20/02/2026*
*Próxima revisão: Após setup do projeto (TAREFA-002)*
