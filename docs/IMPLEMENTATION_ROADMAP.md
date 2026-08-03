# Pediu Aqui — Roadmap de Implementação

Regras gerais: uma fase por vez; nenhuma fase inicia antes de suas dependências; nenhuma funcionalidade fora da fase; nenhum avanço automático para a fase seguinte.

Legenda de áreas: `DOC` documentação, `UI` interface, `DB` banco, `SEC` segurança, `OPS` operação/infra, `APP` Android.

---

## Fase 01 — Fundação e documentação
- **Status:** CONCLUÍDA.

## Fase 02 — Identidade visual e design system
- **Status:** CONCLUÍDA.

## Fase 03 — Protótipo navegável
- **Status:** CONCLUÍDA.

## Fase 04 — Arquitetura do banco
- **Status:** CONCLUÍDA.

## Fase 05 — Autenticação
- **Status:** CONCLUÍDA.

## Fase 06 — Multi-tenancy e RLS
- **Status:** CONCLUÍDA.

## Fase 07 — Perfis e permissões
- **Status:** CONCLUÍDA.

## Fase 08 — Configurações da loja
- **Status:** CONCLUÍDA.

## Fase 09 — Catálogo básico
- **Status:** CONCLUÍDA.

## Fase 10 — Variações e grupos de opções
- **Status:** CONCLUÍDA.

## Fase 11 — Cardápio público
- **Status:** CONCLUÍDA.

## Fase 12 — Fluxo inicial do cliente
- **Status:** CONCLUÍDA.

## Fase 13 — Endereço
- **Status:** CONCLUÍDA.

## Fase 14 — Carrinho
- **Status:** CONCLUÍDA.

## Fase 15 — Checkout
- **Status:** CONCLUÍDA.

## Fase 16 — Criação segura de pedido
- **Status:** CONCLUÍDA.

## Fase 17 — Acompanhamento do pedido
- **Status:** CONCLUÍDA.

## Fase 18 — Painel de pedidos
- **Status:** CONCLUÍDA.

## Fase 19 — Modo cozinha
- **Status:** CONCLUÍDA.

## Fase 20 — Relatórios de entregas e contador derivado
- **Status:** CONCLUÍDA.

## Fase 21 — Painel Administrativo do SaaS
- **Status:** CONCLUÍDA.

## Fase 22 — Planos, assinaturas e mensalidades
- **Objetivo:** planos, valor, vencimento, tolerância, status, desconto, cortesia, histórico, suspensão e reativação.
- **Status:** CONCLUÍDA (2026-08-03). Entregas: `public.plans`, `public.store_subscriptions`, `public.subscription_payments` (imutável), RPC `private.register_manual_payment`, permissões financeiras e audit log.

## Fase 23 — Dashboard Administrativo Consolidado
- **Objetivo:** visão geral do SaaS, métricas de crescimento e saúde financeira sanitizada.
- **Status:** pendente.
