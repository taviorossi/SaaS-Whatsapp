# TAREFA-002: Setup do Projeto (Monorepo, Configs, CI/CD)

## Contexto
Com a arquitetura definida (TAREFA-001), precisamos criar o projeto base com toda a estrutura de monorepo, dependências, configurações de lint/format, Docker para dev, e pipeline CI/CD.

## Problema/Necessidade
Criar o esqueleto do projeto com todas as configurações necessárias para que a equipe possa começar a desenvolver imediatamente após o setup.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**O que precisa ser feito:**
- Inicializar monorepo com Turborepo
- Criar `apps/api` com NestJS + TypeScript
- Criar `apps/web` com Next.js 14+ App Router
- Criar `packages/shared` para tipos compartilhados
- Configurar ESLint + Prettier + Husky + lint-staged
- Configurar Docker Compose (Postgres + Redis)
- Configurar `.env.example` com todas as variáveis
- Criar `README.md` com instruções de setup
- Configurar GitHub Actions (lint, test, build)
- Configurar Prisma com schema inicial

**Dependências:**
- TAREFA-001 (arquitetura definida)

## Critérios de Aceite
- [x] Monorepo funcional com Turborepo
- [x] `apps/api` roda com NestJS (hello world)
- [x] `apps/web` roda com Next.js (hello world)
- [x] Docker Compose sobe Postgres + Redis
- [x] ESLint + Prettier configurados e funcionando
- [x] Husky + lint-staged em pre-commit
- [x] CI pipeline rodando no GitHub Actions
- [x] README com instruções completas de setup
- [x] `.env.example` documentado

## Classificação
- **Tipo:** Feature
- **Prioridade:** Crítica
- **Área:** Fullstack
- **Nível:** N8
- **Status:** CONCLUÍDA

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
