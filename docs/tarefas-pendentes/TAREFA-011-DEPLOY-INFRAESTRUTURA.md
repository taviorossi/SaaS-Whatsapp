# TAREFA-011: Deploy e Infraestrutura

## Contexto
O SaaS precisa estar acessível 24/7 para receber mensagens do WhatsApp. A infraestrutura precisa ser confiável, escalável e com custo controlado para um MVP.

## Problema/Necessidade
Configurar toda a infraestrutura de deploy: ambientes (staging/produção), banco de dados gerenciado, Redis, domínio, SSL, monitoramento, e pipelines de CI/CD.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Infraestrutura Proposta (MVP):**

| Serviço | Opção 1 (Simples) | Opção 2 (Escalável) |
|---------|-------------------|---------------------|
| Backend API | Railway | AWS ECS/Fargate |
| Frontend | Vercel | Vercel |
| PostgreSQL | Neon (free tier) | Supabase / RDS |
| Redis | Upstash (free tier) | ElastiCache |
| Domínio | Cloudflare | Cloudflare |
| Logs | Axiom (free tier) | Datadog |
| Erros | Sentry (free tier) | Sentry |
| CI/CD | GitHub Actions | GitHub Actions |

**Ambientes:**
- `staging` - Para testes e homologação
- `production` - Produção

**Configurações necessárias:**
1. **Domínio**: comprazap.com.br (ou similar)
2. **SSL**: Cloudflare (automático)
3. **DNS**: Cloudflare
4. **Webhook URL**: https://api.comprazap.com.br/webhook/whatsapp
5. **CORS**: Configurar para dashboard
6. **Rate Limiting**: Nginx/Cloudflare

**CI/CD Pipeline:**
```
Push → Lint → Test → Build → Deploy (staging)
Tag → Deploy (production)
```

**Variáveis de ambiente necessárias:**
```
# App
NODE_ENV=production
PORT=3000
API_URL=https://api.comprazap.com.br

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# WhatsApp
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...

# Gemini
GEMINI_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Auth
JWT_SECRET=...
JWT_EXPIRATION=...

# Sentry
SENTRY_DSN=...
```

**Monitoramento:**
- Health check endpoint com alertas
- Uptime monitoring (Better Uptime / UptimeRobot)
- Error tracking (Sentry)
- Log aggregation (Axiom)
- Métricas de API (latência, 5xx, etc.)

## Critérios de Aceite
- [ ] Backend deployado e acessível via HTTPS
- [ ] Frontend deployado na Vercel
- [ ] PostgreSQL gerenciado rodando
- [ ] Redis gerenciado rodando
- [ ] Domínio configurado com SSL
- [ ] CI/CD pipeline funcional (push → deploy)
- [ ] Health check endpoint respondendo
- [ ] Sentry capturando erros
- [ ] Logs centralizados
- [ ] Variáveis de ambiente seguras (secrets)
- [ ] Ambiente staging funcional
- [ ] Documentação de deploy

## Classificação
- **Tipo:** Feature
- **Prioridade:** Alta
- **Área:** Infraestrutura
- **Nível:** N16
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
