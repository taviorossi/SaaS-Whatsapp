# ADR-004: Integração WhatsApp — Meta Cloud API com Queue-First Pattern

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O WhatsApp é o canal principal de interação do CompraZap. Usuários enviam mensagens de texto (e futuramente áudio/imagem) para um número de WhatsApp Business, que são processadas por IA e respondidas automaticamente.

Requisitos:
- Receber mensagens em tempo real (webhook)
- Enviar respostas formatadas
- Suporte a texto, imagens (listas), templates
- Lidar com picos de tráfego sem perder mensagens
- Validação de segurança dos webhooks
- Compliance com políticas da Meta

## Decision

Usar a **Meta Cloud API** (API oficial do WhatsApp Business Platform) com um padrão **queue-first** para processamento de mensagens.

### Fluxo:

```
Webhook POST → Validar assinatura → Enfileirar (BullMQ) → HTTP 200
                                          │
                                          ▼
                                    Worker processa:
                                    1. Parse payload
                                    2. Identifica usuário
                                    3. Chama Gemini API
                                    4. Envia resposta via Cloud API
```

### SDK: `whatsapp` (npm, SDK oficial da Meta)
### API Version: v21.0+

## Alternatives Considered

### Processamento Síncrono (sem fila)

**Prós:** Implementação mais simples, menos infraestrutura
**Contras:** Webhook da Meta tem timeout de ~15s. Chamada Gemini API pode levar 2-5s. Sob carga, respostas atrasam, Meta reenvia webhooks, causando cascata de duplicatas. Uma falha no Gemini derruba todo o processamento.
**Veredicto:** Inviável para produção. Queue-first é requisito, não opção.

### WhatsApp Business API (On-Premises)

**Veredicto:** Deprecada pela Meta em outubro 2025. Cloud API é a única opção suportada.

### Provedores Terceiros (Twilio, MessageBird)

**Prós:** APIs mais ergonômicas, suporte multi-canal
**Contras:** Custo por mensagem significativamente maior. Layer extra de abstração. Dependency em terceiro que pode mudar pricing ou descontinuar. Funcionalidades avançadas da Meta API podem não estar disponíveis imediatamente.
**Veredicto:** Desnecessário quando a Meta oferece API oficial gratuita (custo apenas por conversa).

## Consequences

### Positivas
- Confiabilidade: fila garante que nenhuma mensagem é perdida, mesmo se IA estiver lenta
- Escalabilidade: workers BullMQ processam em paralelo, escalam horizontalmente
- Resiliência: falha no Gemini não bloqueia recebimento de novas mensagens
- Retry automático: BullMQ faz retry com backoff para falhas transitórias
- DLQ (Dead Letter Queue): mensagens que falharem N vezes vão para fila separada para análise
- Throughput: HTTP 200 imediato garante que Meta não reenvia duplicatas

### Negativas
- Latência adicional: ~50-100ms de enqueue/dequeue vs processamento direto
- Complexidade: mais componentes (queue, worker, DLQ) para manter
- Debugging mais difícil: mensagem passa por múltiplos estágios
- Dependência do Redis para a fila funcionar

### Detalhes de Implementação

**Validação de Webhook:**
- Toda request deve ter `X-Hub-Signature-256` validado com constant-time comparison
- Token de verificação para GET de setup do webhook

**Processamento de Payload:**
- Webhooks contêm arrays aninhados (`entry[].changes[].value.messages[]`)
- Processar TODOS os elementos de cada array (não apenas `[0]`)
- Media payloads contêm apenas `media_id` — download via API separada

**Retry Policy:**
- Max attempts: 3
- Backoff: exponencial (1s, 5s, 25s)
- DLQ após 3 falhas
- Alerta Sentry em toda mensagem que vai para DLQ

**Ação Obrigatória (março 2026):**
- Atualizar certificado mTLS com novo CA da Meta (`meta-outbound-api-ca-2025-12.pem`) antes de 31/03/2026
