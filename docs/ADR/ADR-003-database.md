# ADR-003: Banco de Dados — Neon PostgreSQL Serverless

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O CompraZap precisa de um banco relacional para persistir:
- Usuários e perfis (identificados por phone number)
- Conversas e mensagens (histórico completo)
- Listas de compras e itens
- Assinaturas e eventos de billing
- Webhook events (idempotência)

Requisitos:
- PostgreSQL (exigido pelo Prisma 7 com melhor suporte)
- Managed service (equipe pequena, sem DBA)
- Custo baixo para MVP
- Preview databases por PR/branch (para CI e development)
- Boa integração com Prisma e Vercel

## Decision

Usar **Neon PostgreSQL** como banco managed serverless.

### Configuração planejada:
- **Development:** Branch `dev` com auto-suspend (scale-to-zero após 5 min)
- **Staging:** Branch `staging` com auto-suspend
- **Production:** Branch `main` com auto-scaling de compute
- **Preview:** Branch por PR (criada automaticamente via Vercel integration)

### Versão: PostgreSQL 16+
### ORM: Prisma 7 com `@prisma/adapter-pg`

## Alternatives Considered

### Supabase

**Prós:**
- Backend completo: auth, storage, realtime, edge functions incluídos
- Pricing flat e previsível ($25/mês Pro)
- Dashboard visual poderoso
- Row Level Security nativo

**Contras:**
- Pagamos por auth, storage, realtime que não usaremos (Clerk para auth, não precisamos de realtime DB)
- Sem branching instantâneo (migrations-based, mais lento para CI)
- Dedicated compute — sem scale-to-zero para dev/staging
- Vendor lock-in mais forte (APIs proprietárias vs pure Postgres)

**Veredicto:** Excelente quando se usa o ecossistema completo Supabase. No nosso caso, usar apenas o Postgres do Supabase é desperdiçar o que o diferencia.

### AWS RDS

**Prós:**
- Standard da indústria, escalabilidade comprovada
- Multi-AZ para alta disponibilidade
- Controle total de configuração

**Contras:**
- Preço mínimo ~$30/mês (db.t3.micro), sem scale-to-zero
- Complexidade de VPC, Security Groups, parameter groups
- Sem branching
- Sem integração com Vercel

**Veredicto:** Opção futura para escala (10k+ usuários). Migração de Neon → RDS é straightforward (ambos são PostgreSQL padrão).

### Docker Compose (self-hosted)

**Veredicto:** Apenas para development local. Não considerado para staging/production.

## Consequences

### Positivas
- Scale-to-zero elimina custo em ambientes ociosos (dev, staging, preview)
- Branching instantâneo (copy-on-write) — preview DB por PR em segundos
- Cold start ~5ms — imperceptível para o usuário
- Integração nativa Vercel + Neon para connection strings automáticas
- PostgreSQL padrão — zero vendor lock-in no schema/queries
- Plano Free generoso para início (0.5 GiB storage, 191 compute hours)

### Negativas
- Serverless pode ter latência adicional vs dedicated (~5-10ms cold start)
- Connection pooling requer atenção com Prisma (PgBouncer mode do Neon)
- Storage billing pode crescer com volume de mensagens (monitorar)
- Menor ecossistema de extensions vs RDS

### Mitigações
- Monitorar cold start latency via Axiom
- Configurar Prisma connection pool adequadamente ao tier
- Implementar data retention policy para mensagens antigas (archive/delete > 90 dias no plano Free)
- Avaliar migração para Neon Launch ($19/mês) quando free tier não for suficiente
