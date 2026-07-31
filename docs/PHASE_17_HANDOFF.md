# Fase 17 → Fase 18 — Handoff

## Estado atual

Cozinha em produção como projeção do painel: lê `list_my_kitchen_orders`, escreve pelos
wrappers da Fase 16, sem PII e sem valores.

## Reaproveitável

- `private.transition_store_order` continua sendo o único caminho de mudança de estado.
- `private.kitchen_allowed_actions` é o padrão para “quais botões existem”.
- `store_order_realtime_events` já serve painel e cozinha; novos ambientes só precisam de
  policy por permissão, nunca de payload maior.
- `useKitchenQueue` é o modelo de Realtime com fallback único e offline.

## Cuidados para quem continuar

- Não adicionar campo à projeção da cozinha sem revisar `KITCHEN_MODE_DATA_PROJECTION.md`.
- Não introduzir transição otimista na fila compartilhada.
- Não criar coluna de tempo decorrido: tempo é derivado.

## Pendências

- Executar o roteiro de `KITCHEN_MODE_QA_PLAN.md` assim que existirem pedidos reais.
- Fila de expedição, entregadores e impressão pertencem a fases posteriores.
