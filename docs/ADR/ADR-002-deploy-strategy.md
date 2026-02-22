# ADR-002: Estratégia de Deploy — Railway + Vercel + Neon + Upstash

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O CompraZap tem dois componentes deployáveis (API NestJS + Frontend Next.js) e dois serviços de dados (PostgreSQL + Redis). Precisamos de uma estratégia de deploy que:

- Suporte long-running processes (BullMQ workers)
- Ofereça preview environments por PR
- Tenha custo baixo para MVP (< $100/mês)
- Escale conforme o produto cresce
- Minimize complexidade operacional (equipe pequena)
- Suporte Docker para o backend

## Decision

Deploy distribuído por responsabilidade, usando o serviço mais adequado para cada componente:

| Componente | Serviço | Justificativa |
|-----------|---------|---------------|
| API NestJS | **Railway** (Pro, $20/mês base) | Containers Docker, long-running, horizontal scaling |
| Frontend Next.js | **Vercel** (Pro, $20/mês) | Zero-config Next.js, edge, preview deploys |
| PostgreSQL | **Neon** (Free → Launch) | Serverless, scale-to-zero, branching |
| Redis | **Upstash** (Fixed, $10/mês) | Serverless, TLS, otimizado para BullMQ |

### Custo total estimado MVP: $55-90/mês

## Alternatives Considered

### Tudo no Railway

**Prós:** Single platform, simplifica billing e gestão
**Contras:** Railway não é otimizado para Next.js (sem edge, sem ISR, sem preview deploys automáticos). Custo de Postgres e Redis managed no Railway é maior que Neon + Upstash.
**Veredicto:** Sacrifica DX do frontend sem ganho significativo.

### Tudo na Vercel

**Prós:** Single platform para frontend + API
**Contras:** Vercel Functions têm limite de 13.3 min — inviável para BullMQ workers. Sem suporte a long-running processes. Pricing de bandwidth pode ser imprevisível. Backend NestJS com Fastify não é o caso de uso ideal para serverless.
**Veredicto:** Tecnicamente incompatível com nosso backend (BullMQ, webhooks long-running).

### AWS ECS/Fargate + RDS

**Prós:** Escala infinita, controle total
**Contras:** Custo mínimo ~$150/mês (RDS mínimo ~$30 + ECS ~$50 + VPC/NAT). Complexidade de VPC, Security Groups, IAM. Overkill para MVP com 0 usuários.
**Veredicto:** Opção futura quando escala justificar complexidade. Migração de Railway → ECS é straightforward (ambos usam Docker).

### Render

**Prós:** Comparável ao Railway, pricing transparente
**Contras:** DX ligeiramente inferior para multi-service. Comunidade menor. Auto-scaling menos maduro.
**Veredicto:** Alternativa válida se Railway apresentar problemas. Manter como backup.

## Consequences

### Positivas
- Custo otimizado por componente — cada serviço no provider mais eficiente
- Preview environments automáticos: Vercel (frontend por PR) + Neon branching (DB por PR)
- Railway Pro inclui horizontal scaling quando necessário
- Neon scale-to-zero elimina custo quando sem tráfego (dev/staging)
- Upstash Fixed plan evita custos inesperados de polling do BullMQ
- Migração futura para AWS é possível sem reescrita (Docker container + PostgreSQL padrão)

### Negativas
- 4 providers diferentes para gerenciar (billing, status, support)
- Latência inter-serviço (Railway → Neon/Upstash) pode ser maior que colocated
- Dependência de múltiplos SaaS — se um cair, afeta o sistema

### Mitigações
- Centralizar monitoramento em Sentry + Axiom (visão unificada)
- Escolher mesma região em todos os providers (us-east-1 / iad1)
- Health checks e alertas em cada serviço
