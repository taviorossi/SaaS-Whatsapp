# TAREFA-005: Integração Gemini API (Conversação IA)

## Contexto
O Gemini é o cérebro da aplicação. Ele recebe o contexto da conversa e gera respostas inteligentes para ajudar o usuário a planejar suas compras.

## Problema/Necessidade
Implementar o módulo de integração com a API do Google Gemini, incluindo gerenciamento de contexto de conversa, system prompts especializados, e tratamento de respostas estruturadas.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Google Gemini API - Componentes:**
1. **Chat Session** - Conversa com histórico
2. **System Instruction** - Prompt que define o comportamento
3. **Safety Settings** - Filtros de conteúdo
4. **Generation Config** - Temperatura, tokens, etc.
5. **Structured Output** - JSON mode para listas

**Arquitetura do módulo:**
```
modules/gemini/
├── gemini.module.ts
├── gemini.service.ts          # Client da API
├── gemini.prompts.ts          # System prompts
├── gemini.parser.ts           # Parser de respostas
├── interfaces/
│   └── gemini.types.ts
└── constants/
    └── gemini.constants.ts
```

**System Prompt (conceito):**
```
Você é um assistente especializado em planejamento de compras.
Seu objetivo é ajudar o usuário a:
1. Organizar listas de compras
2. Sugerir produtos dentro do orçamento
3. Priorizar itens essenciais
4. Dar dicas de economia
...
Sempre responda em português brasileiro, de forma amigável e concisa.
Quando gerar listas, use formato estruturado.
```

**Considerações:**
- Gemini 2.0 Flash para custo-benefício (MVP)
- Contexto máximo: ~1M tokens (suficiente para histórico longo)
- Streaming para respostas longas (enviar em partes)
- Cache de respostas similares (Redis)
- Fallback se API estiver indisponível
- Controle de tokens consumidos por usuário

## Critérios de Aceite
- [ ] Integração funcional com Gemini API
- [ ] System prompt especializado em compras
- [ ] Gerenciamento de histórico de conversa
- [ ] Respostas em formato estruturado (JSON) quando necessário
- [ ] Controle de temperatura e parâmetros por contexto
- [ ] Tratamento de erros da API (rate limit, timeout, etc.)
- [ ] Métricas: tokens usados, latência, erros
- [ ] Cache de respostas frequentes
- [ ] Testes com mocks da API

## Classificação
- **Tipo:** Feature
- **Prioridade:** Crítica
- **Área:** Backend
- **Nível:** N16
- **Status:** CONCLUÍDA

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
