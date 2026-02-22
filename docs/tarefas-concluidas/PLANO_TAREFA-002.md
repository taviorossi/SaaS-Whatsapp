# Plano de Implementação — TAREFA-002: Setup do Projeto

> **Objetivo:** Criar o esqueleto do monorepo CompraZap com Turborepo, apps (api/web), packages (shared/ui), Docker Compose, ESLint/Prettier/Husky/Commitlint/lint-staged, CI no GitHub Actions, .env.example e README.

**Referências obrigatórias:**
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — estrutura do monorepo e stack
- [docs/CODING_STANDARDS.md](../CODING_STANDARDS.md) — ESLint, Prettier, EditorConfig, Husky, commitlint, lint-staged
- [docs/ADR/ADR-006-monorepo.md](../ADR/ADR-006-monorepo.md) — Turborepo + pnpm

**Versões alvo:** Node 22, pnpm 9+, TypeScript 5.9+, Next.js 15, NestJS 11, Prisma 7 (ou 6 se 7 não está estável no momento da execução).

---

## Etapa 1: Raiz do monorepo

**Objetivo:** Inicializar o monorepo com pnpm workspaces e Turborepo na raiz.

### 1.1 Pré-requisitos

- Node.js 22 LTS instalado (`node -v` deve retornar v22.x).
- pnpm 9+ instalado: `corepack enable` e `corepack prepare pnpm@latest --activate`, ou `npm install -g pnpm`.

### 1.2 Comandos e arquivos

1. **Criar `package.json` na raiz**
   Conteúdo: name `comprazap`, `private: true`, `scripts` com `build`, `dev`, `lint`, `test`, `format`, `prepare` (husky).
   `engines`: `"node": ">=22.0.0"`, `"pnpm": ">=9.0.0"`.
   `packageManager`: `"pnpm@9.x.x"` (ou versão exata desejada).
   Sem dependências de produção na raiz; apenas devDependencies para ferramentas globais (turbo, etc.) — ver etapa 2.

2. **Criar `pnpm-workspace.yaml`**
   Conteúdo conforme ADR-006:
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```

3. **Criar `turbo.json`**
   Conteúdo conforme ADR-006 (pipelines `build`, `lint`, `test`, `dev` com `dependsOn`, `outputs`, `cache: false` para `dev`).
   Usar key `tasks` em vez de `pipeline` se a versão do Turbo for recente (Turbo 2.x usa `tasks`).

4. **Criar `.nvmrc`** (opcional mas recomendado)
   Conteúdo: `22`.

5. **Criar `.gitignore`**
   Incluir: `node_modules`, `.env`, `.env.local`, `.next`, `dist`, `coverage`, `.turbo`, `*.log`, `.DS_Store`, IDE, etc.
   Padrão para Node/Next/Nest/Prisma.

6. **Instalar Turbo na raiz (após package.json criado):**
   ```powershell
   pnpm add -D turbo
   ```

---

## Etapa 2: Configurações compartilhadas (ESLint, Prettier, EditorConfig, Commitlint, lint-staged, Husky)

**Objetivo:** Centralizar lint, formatação e git hooks na raiz, conforme CODING_STANDARDS.md.

_(Etapas 2 a 10 — conforme documento original em tarefas-pendentes.)_

---

*Plano criado em: 20/02/2026. Executor: seguir etapas na ordem; em caso de divergência de versões (ex.: Prisma 7 vs 6), optar pela versão estável documentada.*
