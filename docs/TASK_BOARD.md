# TASK BOARD - CompraZap

> SaaS de Planejamento de Compras via WhatsApp + IA (Gemini)
> Atualizado em: 20/02/2026 — TAREFA-005 concluída (Integração Gemini API)

---

## Resumo

| Status | Qtd |
|--------|-----|
| PENDENTE_PLANO | 6 |
| PENDENTE_APROVAÇÃO | 0 |
| APROVADA | 0 |
| EM_DESENVOLVIMENTO | 0 |
| CONCLUÍDA | 5 |
| VALIDADA | 0 |
| **Total** | **11** |

---

## Estimativa Total: ~180h (~4-5 semanas full-time)

---

## Aguardando Aprovação (PENDENTE_APROVAÇÃO)

_Nenhuma tarefa aguardando aprovação._

---

## Pendentes (PENDENTE_PLANO)

### Fase 1 - Fundação (Críticas)

| # | Tarefa | Área | Nível | Prioridade | Depende de |
|---|--------|------|-------|------------|------------|
| 007 | Banco de Dados (Modelagem) | Backend | N8 | Crítica | 002 |

### Fase 2 - Integrações Core (Críticas/Altas)

| # | Tarefa | Área | Nível | Prioridade | Depende de |
|---|--------|------|-------|------------|------------|
| 006 | Motor de Planejamento de Compras | Backend | N24 | Alta | 004, 005, 007 |

### Fase 3 - Frontend e Monetização (Altas/Médias)

| # | Tarefa | Área | Nível | Prioridade | Depende de |
|---|--------|------|-------|------------|------------|
| 009 | Landing Page | Frontend | N16 | Alta | 002 |
| 010 | Billing e Assinaturas (Stripe) | Fullstack | N24 | Alta | 003, 006 |
| 008 | Dashboard Admin | Frontend | N32 | Média | 003, 006 |

### Fase 4 - Infraestrutura

| # | Tarefa | Área | Nível | Prioridade | Depende de |
|---|--------|------|-------|------------|------------|
| 011 | Deploy e Infraestrutura | Infra | N16 | Alta | 002 |

---

## Grafo de Dependências

```
TAREFA-001 (Arquitetura)
    └── TAREFA-002 (Setup)
            ├── TAREFA-003 (Backend Core)
            │       ├── TAREFA-004 (WhatsApp) ──┐
            │       ├── TAREFA-005 (Gemini) ────┤
            │       │                           ▼
            │       │              TAREFA-006 (Motor Compras)
            │       │                      │
            │       │               TAREFA-010 (Billing)
            │       │               TAREFA-008 (Dashboard)
            │       │
            ├── TAREFA-007 (Banco) ─────────────┘
            ├── TAREFA-009 (Landing Page)
            └── TAREFA-011 (Deploy/Infra)
```

---

## Ordem de Execução Sugerida

### Sprint 1 (Semana 1)
- [001] Arquitetura → [002] Setup → [007] Banco de Dados
- [011] Deploy/Infra (em paralelo com 002)

### Sprint 2 (Semana 2)
- [003] Backend Core
- [009] Landing Page (em paralelo)

### Sprint 3 (Semana 3)
- [004] WhatsApp + [005] Gemini (em paralelo)

### Sprint 4 (Semana 4)
- [006] Motor de Compras (conecta tudo)

### Sprint 5 (Semana 5)
- [010] Billing + [008] Dashboard (em paralelo)

---

## Concluídas

| # | Tarefa | Área | Nível | Data |
|---|--------|------|-------|------|
| 001 | Definição de Arquitetura e Stack | Fullstack | N4 | 20/02/2026 |
| 002 | Setup do Projeto (Monorepo) | Fullstack | N8 | 20/02/2026 |
| 003 | Backend API Core (Auth, Base) | Backend | N16 | 20/02/2026 |
| 004 | Integração WhatsApp Business API | Backend | N16 | 20/02/2026 |
| 005 | Integração Gemini API | Backend | N16 | 20/02/2026 |

## Validadas

_Nenhuma tarefa validada ainda._

## Released

_Nenhuma release ainda._

---

*Board gerenciado por JARVIS v2*
