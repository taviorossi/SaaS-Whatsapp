# TAREFA-008: Dashboard Admin (Painel de Gestão)

## Contexto
O dashboard admin é onde o dono do SaaS monitora e gerencia o negócio: usuários, conversas, métricas de uso, configurações da IA, e relatórios financeiros.

## Problema/Necessidade
Criar o painel administrativo com Next.js, incluindo autenticação, páginas de métricas, gestão de usuários, monitoramento de conversas, e configurações.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Páginas do Dashboard:**

```
/dashboard
├── /                    # Overview (métricas gerais)
├── /users               # Lista de usuários
├── /users/[id]          # Detalhe do usuário
├── /conversations       # Monitoramento de conversas
├── /conversations/[id]  # Detalhe da conversa
├── /analytics           # Métricas detalhadas
├── /settings            # Configurações
│   ├── /prompts         # System prompts da IA
│   ├── /plans           # Gestão de planos
│   └── /general         # Config geral
└── /billing             # Relatórios financeiros
```

**Componentes principais:**
- Sidebar com navegação
- Cards de métricas (MAU, mensagens, receita)
- Gráficos de uso ao longo do tempo
- Tabelas com filtro/busca/paginação
- Visualizador de conversas (estilo chat)
- Editor de system prompts

**Métricas do Overview:**
- Usuários ativos (diário/semanal/mensal)
- Total de mensagens enviadas
- Tokens Gemini consumidos (custo)
- Listas de compras criadas
- Taxa de conversão (free → pago)
- Receita mensal (MRR)

**Stack:**
- Next.js 14+ App Router
- shadcn/ui + Tailwind
- Recharts para gráficos
- TanStack Table para tabelas
- NextAuth.js ou Clerk para auth admin

## Critérios de Aceite
- [ ] Autenticação admin (email + senha ou SSO)
- [ ] Página overview com métricas gerais
- [ ] CRUD de usuários com busca e filtros
- [ ] Visualizador de conversas
- [ ] Gráficos de uso (mensagens, usuários, receita)
- [ ] Editor de system prompts
- [ ] Gestão de planos e limites
- [ ] Layout responsivo
- [ ] Loading states e error boundaries
- [ ] Testes E2E das páginas principais

## Classificação
- **Tipo:** Feature
- **Prioridade:** Média
- **Área:** Frontend
- **Nível:** N32
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
