# TAREFA-010: Sistema de Billing e Assinaturas

## Contexto
Para monetizar o SaaS, precisamos de um sistema de billing robusto. O Stripe é o padrão de mercado para SaaS e oferece APIs completas para assinaturas recorrentes.

## Problema/Necessidade
Implementar integração completa com Stripe para gerenciamento de assinaturas, cobrança recorrente, controle de planos e limites de uso por plano.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Componentes do Billing:**

1. **Stripe Integration**
   - Criar customer no Stripe ao registrar usuário
   - Checkout Session para upgrade de plano
   - Customer Portal para gerenciar assinatura
   - Webhooks para eventos de pagamento

2. **Controle de Uso**
   - Contador de mensagens por mês
   - Reset mensal no dia do billing cycle
   - Soft limit (aviso) e hard limit (bloqueio)
   - Mensagem no WhatsApp quando limite se aproxima

3. **Planos**
   - Free: 50 msgs/mês
   - Básico: 500 msgs/mês - R$ 19,90
   - Pro: 2.000 msgs/mês - R$ 49,90
   - Família: 5.000 msgs/mês - R$ 79,90

**Módulo NestJS:**
```
modules/billing/
├── billing.module.ts
├── billing.controller.ts     # Webhooks Stripe
├── billing.service.ts        # Lógica de billing
├── stripe.service.ts         # Client Stripe
├── usage.service.ts          # Controle de uso
├── dto/
└── interfaces/
```

**Webhooks Stripe a tratar:**
- `checkout.session.completed` → Ativa assinatura
- `invoice.paid` → Confirma pagamento
- `invoice.payment_failed` → Notifica usuário
- `customer.subscription.updated` → Atualiza plano
- `customer.subscription.deleted` → Cancela acesso

## Critérios de Aceite
- [ ] Integração Stripe (customers, subscriptions, checkout)
- [ ] Checkout Session para upgrade de plano
- [ ] Customer Portal para gerenciar assinatura
- [ ] Webhooks recebendo e processando eventos
- [ ] Controle de uso (mensagens) por plano
- [ ] Soft/hard limit com notificação via WhatsApp
- [ ] Reset mensal de contadores
- [ ] Página de pricing no dashboard
- [ ] Testes com Stripe Test Mode

## Classificação
- **Tipo:** Feature
- **Prioridade:** Alta
- **Área:** Fullstack
- **Nível:** N24
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
