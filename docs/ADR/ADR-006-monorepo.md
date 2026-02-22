# ADR-006: Monorepo — Turborepo com pnpm Workspaces

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O CompraZap tem múltiplos packages que compartilham código:
- `apps/api` — Backend NestJS
- `apps/web` — Frontend Next.js (landing + dashboard)
- `packages/shared` — Types, utils, schemas compartilhados
- `packages/ui` — Componentes UI base

Precisamos de um monorepo tool que:
- Orquestre builds com caching eficiente
- Gerencie dependências entre packages
- Acelere CI/CD com builds incrementais
- Tenha setup simples e baixa curva de aprendizado
- Integre com Vercel (deploy do frontend) e GitHub Actions (CI)

## Decision

Usar **Turborepo** para build orchestration + **pnpm** como package manager com workspaces nativos.

### Configuração:

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**turbo.json:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Remote Caching: Vercel Remote Cache (incluso no Vercel Pro)

## Alternatives Considered

### Nx

**Prós:**
- Performance superior em monorepos grandes: 2.1 min vs 8.7 min Turbo em benchmarks de repos 15+ apps
- Dependency graph computation em Rust (pré-computa via daemon)
- Plugins dedicados para NestJS, Next.js, React
- Nx Cloud para remote caching
- Generators para scaffolding de novos módulos
- Memory usage menor (200MB vs 800MB em grandes repos)

**Contras:**
- Overhead de configuração significativo para 4 packages
- Daemon ocasionalmente requer reset (instabilidade reportada em 2026)
- Curva de aprendizado maior (project.json, nx.json, workspace.json)
- Plugins adicionam camada de abstração sobre ferramentas que já conhecemos
- Para o tamanho do CompraZap, a diferença de performance é negligível

**Veredicto:** Nx é objetivamente superior para monorepos grandes. Para nosso escopo (2 apps + 2 packages), a simplicidade do Turborepo prevalece. Se o projeto crescer para 10+ packages, reavaliar migração.

### Lerna

**Prós:**
- Ferramenta mais antiga, amplamente conhecida

**Contras:**
- Focado em publicação de pacotes npm, não em build orchestration
- Sem caching inteligente nativo
- Menos mantido que Turbo/Nx
- pnpm workspaces sozinho faz tudo que o Lerna faz para nosso caso

**Veredicto:** Não compete com Turbo/Nx para monorepos de aplicações.

### Sem monorepo tool (pnpm workspaces puro)

**Prós:** Zero overhead, zero dependência extra
**Contras:** Sem caching de builds, sem paralelização inteligente, sem remote caching. CI ficaria lento rapidamente.
**Veredicto:** pnpm workspaces é o gerenciador de deps; Turborepo é o orquestrador de builds. São complementares.

## Consequences

### Positivas
- Setup em <10 minutos: `npx create-turbo@latest` + customizações
- Cache local acelera rebuilds em ~80% (apenas packages alterados rebuildam)
- Remote cache (Vercel) compartilha cache entre CI e dev local
- `turbo run build --filter=api` executa builds filtrados por package
- Pipeline `dependsOn: ["^build"]` garante ordem correta (shared → api/web)
- Integração zero-config com Vercel para deploy do `apps/web`
- pnpm economiza ~50% de disk space vs npm (content-addressable store)

### Negativas
- Turbo é menos eficiente que Nx em repos com 15+ packages (não é nosso caso)
- Sem generators nativos — criação de novos módulos é manual (mitigado por templates/docs)
- Turbo não valida dependências circulares automaticamente — depende de disciplina

### Decisão de Migração Futura
Se o CompraZap crescer para 10+ packages ou 3+ apps, avaliar migração para Nx. O custo de migração é moderado (Nx oferece guia oficial de migração Turbo → Nx).
