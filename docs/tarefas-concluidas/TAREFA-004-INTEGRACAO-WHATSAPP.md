# TAREFA-004: Integração WhatsApp Business API

## Contexto
O WhatsApp é o canal principal de comunicação com os usuários finais. Precisamos integrar com a Meta Cloud API (WhatsApp Business) para receber e enviar mensagens em tempo real.

## Problema/Necessidade
Implementar o módulo completo de integração com WhatsApp: webhook para receber mensagens, serviço para enviar mensagens, gerenciamento de sessões, e tratamento de diferentes tipos de mídia.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Meta Cloud API - Componentes:**
1. **Webhook** - Endpoint POST para receber mensagens
2. **Webhook Verification** - GET com challenge para verificação
3. **Send Message API** - Para enviar respostas
4. **Media API** - Upload/download de mídia

**Fluxo:**
```
WhatsApp → Meta Cloud → Webhook (nosso) → Fila (BullMQ) → Processamento → Gemini → Resposta → Send API → WhatsApp
```

**Tipos de mensagem a suportar (MVP):**
- Texto (entrada e saída)
- Template messages (boas-vindas, confirmações)
- Interactive messages (botões, listas)
- Indicador "digitando..." (typing indicator)

**Considerações:**
- Meta exige HTTPS e domínio verificado para webhook
- Precisa de Business Account + Phone Number
- Rate limits da API (80 msgs/segundo por número)
- Webhook precisa responder em < 5s (daí a fila)
- Retry automático da Meta se webhook falhar

**Módulo NestJS:**
```
modules/whatsapp/
├── whatsapp.module.ts
├── whatsapp.controller.ts    # Webhook endpoint
├── whatsapp.service.ts       # Envio de mensagens
├── whatsapp.processor.ts     # BullMQ processor
├── whatsapp-dedup.service.ts # Deduplicação Redis
├── dto/
│   ├── webhook-payload.dto.ts
│   └── send-message.dto.ts
├── interfaces/
│   └── whatsapp.types.ts
├── constants/
│   └── whatsapp.constants.ts
└── __tests__/
    ├── whatsapp.service.spec.ts
    ├── whatsapp.controller.spec.ts
    ├── whatsapp.processor.spec.ts
    └── whatsapp-dedup.service.spec.ts
```

## Critérios de Aceite
- [x] Webhook recebe e valida mensagens da Meta
- [x] Verificação de webhook (GET challenge) funcionando
- [x] Mensagens entram em fila BullMQ para processamento
- [x] Serviço de envio de mensagens (texto, template, interactive)
- [x] Indicador "digitando..." enviado antes da resposta
- [x] Validação de assinatura do webhook (HMAC)
- [x] Retry logic para envio de mensagens
- [x] Logs de todas as mensagens (entrada/saída)
- [x] Tratamento de duplicatas (message_id)
- [x] Testes unitários e de integração

## Classificação
- **Tipo:** Feature
- **Prioridade:** Crítica
- **Área:** Backend
- **Nível:** N16
- **Status:** CONCLUÍDA

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio

## Implementação
- **Concluída em:** 20/02/2026
- **Arquivos criados/modificados:**
  - `apps/api/src/config/whatsapp.config.ts` (novo)
  - `apps/api/src/config/validation.ts` (atualizado — vars WA_*)
  - `apps/api/src/config/index.ts` (atualizado — whatsappConfig)
  - `apps/api/src/common/decorators/public.decorator.ts` (novo)
  - `apps/api/src/modules/whatsapp/` (módulo completo — novo)
  - `apps/api/src/app.module.ts` (atualizado — BullMQ + WhatsAppModule)
  - `apps/api/src/main.ts` (atualizado — rawBody parser)
  - `apps/api/prisma/schema.prisma` (atualizado — campo phone no User)
  - `apps/api/package.json` (atualizado — @nestjs/bullmq, bullmq, axios, axios-retry)
  - `.env.example` (atualizado — WA_APP_SECRET adicionado)
