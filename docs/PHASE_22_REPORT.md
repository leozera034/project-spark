# Relatório de Execução — Fase 22: Planos, Assinaturas e Mensalidades

## 1. Fundação e Auditoria
- **Gate 21 Concluído**: Auditoria em `docs/PHASE_21_GATE_AUDIT.md` confirmando a segurança do Painel Administrativo.
- **Auditoria de Modelo**: Documentada em `docs/SUBSCRIPTION_MODEL_AUDIT.md`. A Fase 04 já possuía uma tabela `plans` minimalista, que foi expandida e integrada.
- **Imutabilidade**: Implementada em `public.subscription_payments` via triggers de banco que impedem `UPDATE` e `DELETE`.

## 2. Componentes Implementados
- **Global Plans**: Tabela `plans` configurada com centavos, tolerância (`grace_days`) e status (`draft`, `active`, `archived`).
- **Store Subscriptions**: Vínculo entre loja e plano em `store_subscriptions` com controle de ciclo de vida (`active`, `past_due`, `suspended_payment`).
- **Pagamentos Manuais**: RPC `private.register_manual_payment` permite ao administrador registrar recebimentos fora de gateway, gerando faturas imutáveis.
- **Autorização**: Novas permissões `manage_plans`, `manage_subscriptions` e `manage_payments` adicionadas à matriz de autorização.

## 3. Integração Técnica
- **Functions & Server Logic**: Criado `src/lib/billing.functions.ts` com TanStack Start `createServerFn` para gestão de faturamento.
- **Segurança**: RLS configurado em 3 tabelas financeiras, com acesso de leitura para lojistas (apenas seus dados) e controle total para administradores da plataforma.
- **Sanitização**: Valores monetários strictly integers (centavos), moeda fixada em BRL (D-085).

## 4. Decisões de Projeto
- **D-084**: Pagamentos de assinatura são estritamente append-only.
- **D-085**: Uso obrigatório de inteiros para centavos em toda a camada financeira.

## 5. Próximos Passos
- Fase 23: Dashboard Administrativo Consolidado (SaaS Overview).
