# ADR-005: Motor de IA — Google Gemini 3 Flash com Fallback Pro

**Status:** Proposta
**Data:** 20/02/2026
**Decisores:** Octavio

---

## Context

O CompraZap usa IA conversacional para ajudar usuários a planejar compras via WhatsApp. A IA precisa:

- Entender linguagem natural em português (incluindo gírias e abreviações)
- Manter contexto de conversa (memória de sessão)
- Gerar listas de compras estruturadas
- Sugerir produtos, substituições e dicas de economia
- Responder em <3 segundos para boa UX no WhatsApp
- Custo por mensagem viável para modelo freemium (plano Free com 50 msgs/mês)

Volume estimado MVP: ~10k-50k mensagens/mês.

## Decision

Usar **Google Gemini 3 Flash** como modelo principal e **Gemini 3 Pro** como fallback para tarefas que exigem raciocínio complexo.

### Configuração:

| Cenário | Modelo | Custo (input/output per 1M tokens) |
|---------|--------|-------------------------------------|
| Conversa normal, listas simples | Gemini 3 Flash | $0.50 / $3.00 |
| Análise de orçamento, comparações complexas | Gemini 3 Pro | $2.00-4.00 / $12.00-18.00 |

### SDK: `@google/genai` (experimental, suporta Gemini API + Vertex AI)

### Estimativa de custo mensal:
- 50k mensagens/mês × ~500 tokens médios por interação (input+output)
- ~25M tokens/mês → Gemini Flash: ~$12.50 input + $75 output ≈ **~$90/mês**
- Com cache de context e system prompts: estimativa real **~$40-60/mês**

## Alternatives Considered

### OpenAI GPT-4o

**Prós:**
- Modelo mais popular, excelente em português
- SDK maduro e estável
- Ecosystem de tools/functions extenso

**Contras:**
- Pricing: $2.50/1M input, $10.00/1M output (5x mais caro que Flash no input)
- Sem free tier comparável ao Gemini
- Sem context caching nativo (precisa de assistants API, mais complexo)

**Veredicto:** Custo proibitivo para modelo freemium com alto volume de mensagens curtas.

### Anthropic Claude 3.5 Sonnet

**Prós:**
- Excelente raciocínio e seguimento de instruções
- Bom em português

**Contras:**
- Pricing: $3.00/1M input, $15.00/1M output
- Sem free tier
- SDK menos maduro que OpenAI/Google para Node.js

**Veredicto:** Melhor modelo para raciocínio, mas custo não justifica para conversas de compras.

### Open Source (Llama, Mixtral) via Groq/Together

**Prós:**
- Custo potencialmente menor
- Sem vendor lock-in
- Inferência rápida via Groq

**Contras:**
- Qualidade inferior em português para tarefas de planejamento
- Inconsistência em output estruturado
- Providers de inferência podem mudar pricing/disponibilidade
- Necessita mais prompt engineering para resultados comparáveis

**Veredicto:** Opção futura para fallback de baixo custo em respostas simples (ex: "Adicionei à lista").

## Consequences

### Positivas
- Custo-benefício excelente: Flash é 5x mais barato que GPT-4o no input
- Free tier permite desenvolvimento e testes sem custo
- Context caching reduz custo de system prompts repetidos em ~80%
- Multimodal nativo: quando adicionarmos suporte a imagens/áudio, mesmo modelo serve
- Fallback Flash → Pro dá flexibilidade para tarefas de diferentes complexidades
- Gemini 3.1 Pro recém-lançado (fev/2026) oferece upgrade path para raciocínio avançado

### Negativas
- SDK @google/genai ainda experimental — possíveis breaking changes
- Google pode mudar pricing a qualquer momento
- Qualidade em português não extensivamente testada (requer validação no MVP)
- Vendor lock-in no sistema de prompts (formatação e capabilidades específicas Gemini)

### Mitigações
- Abstrair chamada à IA em um service dedicado (`GeminiService`) com interface genérica — facilita trocar provider
- Implementar cache de respostas similares no Redis (hash do prompt + contexto → resposta cacheada)
- Monitorar custo diário via Axiom custom metrics + alertas
- System prompt versionado em arquivos (não hardcoded) para fácil iteração
- Rate limiting agressivo no plano Free (50 msgs/mês) para controlar custo

### Padrão de System Prompt

```
prompts/
├── system-v1.txt          # System prompt principal
├── shopping-list-v1.txt   # Prompt para geração de listas
├── budget-analysis-v1.txt # Prompt para análise de orçamento
└── README.md              # Documentação de cada versão e resultados
```

Prompts são versionados no repo, carregados no startup, e trocáveis via config sem redeploy.
