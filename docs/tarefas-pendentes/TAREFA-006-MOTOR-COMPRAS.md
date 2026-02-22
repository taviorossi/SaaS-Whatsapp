# TAREFA-006: Motor de Planejamento de Compras (Core de Negócio)

## Contexto
Este é o módulo que diferencia o CompraZap de um chatbot genérico. Aqui ficam as regras de negócio para criação, gerenciamento e otimização de listas de compras.

## Problema/Necessidade
Implementar a lógica de negócio core: criação de listas de compras, categorização de produtos, controle de orçamento, preferências do usuário, e o orquestrador de conversa que conecta WhatsApp ↔ Gemini ↔ Core.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Módulos envolvidos:**
```
modules/
├── chat/                    # Orquestrador de conversa
│   ├── chat.module.ts
│   ├── chat.service.ts      # Recebe msg → decide ação → responde
│   ├── chat.session.ts      # Gerencia sessão/contexto
│   └── interfaces/
│
├── shopping/                # Core de listas
│   ├── shopping.module.ts
│   ├── shopping.service.ts
│   ├── shopping-list.entity.ts
│   ├── shopping-item.entity.ts
│   └── dto/
│
└── users/                   # Perfil e preferências
    ├── users.module.ts
    ├── users.service.ts
    ├── user-preferences.entity.ts
    └── dto/
```

**Fluxo do Orquestrador (chat.service):**
```
1. Recebe mensagem da fila (WhatsApp)
2. Identifica/cria usuário pelo número
3. Carrega sessão de conversa (Redis)
4. Monta contexto: histórico + preferências + lista ativa
5. Envia para Gemini com context
6. Parseia resposta (texto vs structured)
7. Se structured → atualiza lista no banco
8. Envia resposta via WhatsApp
9. Atualiza sessão
```

**Categorias de produtos:**
- Frutas/Verduras/Legumes
- Carnes/Proteínas
- Laticínios
- Padaria
- Mercearia/Secos
- Bebidas
- Limpeza
- Higiene Pessoal
- Outros

## Critérios de Aceite
- [ ] Orquestrador conecta WhatsApp ↔ Gemini ↔ Core
- [ ] CRUD de listas de compras
- [ ] Itens com nome, quantidade, categoria, estimativa de preço
- [ ] Categorização automática de produtos
- [ ] Sessão de conversa persistente (Redis)
- [ ] Perfil de usuário com preferências
- [ ] Controle de orçamento por lista
- [ ] Histórico de listas passadas
- [ ] Formatação de lista para WhatsApp (bonita e legível)
- [ ] Testes unitários do orquestrador

## Classificação
- **Tipo:** Feature
- **Prioridade:** Alta
- **Área:** Backend
- **Nível:** N24
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
