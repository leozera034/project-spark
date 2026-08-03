# Auditoria do Modelo de Assinaturas (Fase 22)

Mapeamento da estrutura de faturamento para garantir conformidade com os princípios de imutabilidade e centavos.

## 1. Entidades Globais
- `public.plans`: Tabela global para definição de pacotes comerciais.
- `public.store_subscriptions`: Vínculo único entre loja e plano.
- `public.subscription_payments`: Registro imutável de faturamento e pagamentos.

## 2. Conformidade Técnica
- **Dinheiro em Centavos**: Colunas `monthly_amount_cents`, `amount_paid_cents`, `amount_due_cents` e `discount_amount_cents` implementadas como `integer`.
- **Imutabilidade**: Triggers `tr_prevent_payment_update` e `tr_prevent_payment_delete` bloqueiam mutação em `subscription_payments`.
- **Segurança**: RLS e GRANTs revogam explicitamente `UPDATE` e `DELETE` para todos os papéis em tabelas de auditoria.
- **Tolerância**: Coluna `grace_days` em `plans` permite controle de aviso antes da suspensão automática (futura).

## 3. Estados de Assinatura
- `trialing`: Período inicial.
- `active`: Pagamento em dia.
- `past_due`: Dentro do período de tolerância.
- `suspended_payment`: Bloqueada por falta de pagamento.
- `canceled`: Encerrada.

## 4. Auditoria de Dados Existentes
- A Fase 04 não continha tabelas de faturamento.
- A Fase 21 implementou apenas o status `suspensa_manual` no enum de lojas.
- O enum de status de loja foi expandido para suportar `suspensa_pagamento`.
