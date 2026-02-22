# TAREFA-009: Landing Page

## Contexto
A landing page é a porta de entrada do produto. Precisa comunicar o valor do CompraZap, converter visitantes em usuários, e ter boa performance de SEO.

## Problema/Necessidade
Criar uma landing page moderna e de alta conversão com seções de hero, features, como funciona, pricing, FAQ, e CTA para o WhatsApp.

## Imagens Referenciadas
- N/A

## Análise Técnica Preliminar
**Seções da Landing Page:**

1. **Hero** - Título impactante + CTA WhatsApp + mock do chat
2. **Problema** - Dificuldade de organizar compras
3. **Solução** - Como o CompraZap resolve
4. **Como Funciona** - 3 passos simples (1. Abre WhatsApp 2. Conversa com IA 3. Lista pronta)
5. **Features** - Cards com funcionalidades
6. **Demo** - Simulação de conversa interativa
7. **Pricing** - Tabela de planos
8. **Testimonials** - Depoimentos (quando houver)
9. **FAQ** - Perguntas frequentes
10. **CTA Final** - QR Code do WhatsApp + link direto

**Componentes:**
- Header fixo com CTA
- Animações suaves (Framer Motion)
- QR Code do WhatsApp
- Link wa.me/ direto
- Seção de pricing interativa
- FAQ accordion
- Footer com links legais

**SEO:**
- Meta tags otimizadas
- Schema.org structured data
- Open Graph para compartilhamento
- Sitemap + robots.txt
- Core Web Vitals otimizados

**Stack:**
- Next.js (mesmo app, rota pública)
- Tailwind + shadcn/ui
- Framer Motion para animações
- next/image para otimização de imagens

## Critérios de Aceite
- [ ] Todas as seções implementadas e responsivas
- [ ] CTA do WhatsApp funcional (QR Code + link direto)
- [ ] Animações suaves e performáticas
- [ ] Tabela de pricing interativa
- [ ] FAQ accordion funcional
- [ ] Meta tags e SEO otimizado
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Mobile-first design
- [ ] Dark mode (opcional)
- [ ] Testes visuais (Playwright screenshots)

## Classificação
- **Tipo:** Feature
- **Prioridade:** Alta
- **Área:** Frontend
- **Nível:** N16
- **Status:** PENDENTE_PLANO

## Origem
- **Data:** 20/02/2026
- **Reportado por:** Octavio
