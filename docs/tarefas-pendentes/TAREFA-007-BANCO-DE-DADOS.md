# TAREFA-007: Banco de Dados (Modelagem e Migrations)

## Contexto
Toda a persistência do sistema: usuários, conversas, listas de compras, assinaturas, métricas. PostgreSQL via Prisma ORM.

## Problema/Necessidade
Modelar o banco de dados completo, criar o schema Prisma, gerar migrations, e configurar seeds para desenvolvimento.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Entidades principais:**

```prisma
// Usuário (identificado pelo WhatsApp)
model User {
  id            String   @id @default(cuid())
  phone         String   @unique        // WhatsApp number
  name          String?
  plan          Plan     @default(FREE)
  messagesUsed  Int      @default(0)
  messagesLimit Int      @default(50)
  preferences   Json?                    // Preferências alimentares, etc.
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  conversations Conversation[]
  shoppingLists ShoppingList[]
  subscription  Subscription?
}

// Conversa
model Conversation {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
  status    ConversationStatus @default(ACTIVE)
  context   Json?              // Contexto acumulado
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

// Mensagem individual
model Message {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           MessageRole  // USER, ASSISTANT, SYSTEM
  content        String
  whatsappMsgId  String?  @unique
  tokensUsed     Int?
  createdAt      DateTime @default(now())
}

// Lista de compras
model ShoppingList {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  name      String
  budget    Decimal? @db.Decimal(10,2)
  status    ListStatus @default(ACTIVE)
  items     ShoppingItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Item da lista
model ShoppingItem {
  id             String   @id @default(cuid())
  shoppingListId String
  shoppingList   ShoppingList @relation(fields: [shoppingListId], references: [id])
  name           String
  quantity       Float    @default(1)
  unit           String?          // kg, un, L, etc.
  category       ProductCategory
  estimatedPrice Decimal? @db.Decimal(10,2)
  checked        Boolean  @default(false)
  createdAt      DateTime @default(now())
}

// Assinatura
model Subscription {
  id               String   @id @default(cuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id])
  stripeCustomerId String?
  stripeSubId      String?
  plan             Plan
  status           SubStatus
  currentPeriodEnd DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

// Enums
enum Plan { FREE, BASIC, PRO, FAMILY }
enum ConversationStatus { ACTIVE, ARCHIVED }
enum MessageRole { USER, ASSISTANT, SYSTEM }
enum ListStatus { ACTIVE, COMPLETED, ARCHIVED }
enum SubStatus { ACTIVE, CANCELED, PAST_DUE, TRIALING }
enum ProductCategory {
  FRUITS_VEGETABLES
  MEATS_PROTEINS
  DAIRY
  BAKERY
  GROCERY
  BEVERAGES
  CLEANING
  PERSONAL_CARE
  OTHER
}
```

**Índices importantes:**
- `User.phone` (unique, busca principal)
- `Message.whatsappMsgId` (unique, dedup)
- `Message.conversationId` + `createdAt` (histórico)
- `ShoppingList.userId` + `status` (listas ativas)
- `Subscription.stripeCustomerId` (webhooks Stripe)

## Critérios de Aceite
- [ ] Schema Prisma completo com todas as entidades
- [ ] Migrations geradas e aplicáveis
- [ ] Índices otimizados para queries principais
- [ ] Seed com dados de desenvolvimento
- [ ] Enums bem definidos
- [ ] Relacionamentos com cascade correto
- [ ] Documentação do schema (comentários Prisma)

## Classificação
- **Tipo:** Feature
- **Prioridade:** Crítica
- **Área:** Backend
- **Nível:** N8
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
