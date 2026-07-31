# Fase 17 — Relatório (Modo Cozinha)

## Revalidação da Fase 16 (exigida na aprovação)

- Rota `/pedido/$token` neutralizada; acompanhamento em `/loja/{slug}/acompanhar` com o token
  apenas no fragmento, apagado após a leitura.
- Nenhum registro do token em log, console ou analytics.
- `store_order_realtime_events` sem policy aberta; envelope restrito a loja, pedido, tipo e
  versão. Detalhes em `docs/PHASE_16_REPORT.md`, criado agora por estar ausente.

## Entregas

**Banco**
- `public.list_my_kitchen_orders` — projeção mínima, `SECURITY DEFINER`, exige `kitchen.view`.
- `private.kitchen_allowed_actions` — ações decididas no servidor.
- Policy de `store_order_realtime_events` estendida ao papel cozinha, ainda por loja.
- Índices operacionais para fila, itens, opções e histórico.
- Nenhuma coluna nova em `orders`; nenhuma permissão nova.

**Aplicação**
- `src/kitchen/types.ts`, `api.ts`, `useKitchenOrders.ts`.
- `src/routes/app/loja/cozinha.tsx` — duas filas, cards grandes, tela cheia, abas no mobile.
- Atalho “Modo cozinha” no painel da loja.
- Correção de hidratação em `src/components/feedback/RouteProgress.tsx`.

**Documentação**
`KITCHEN_MODE_ARCHITECTURE`, `_DATA_PROJECTION`, `_PERMISSIONS`, `_TRANSITIONS`, `_REALTIME`,
`_CONCURRENCY`, `_TIMERS`, `_PRIVACY`, `_ACCESSIBILITY`, `_QA_PLAN`, mais D-069 a D-074.

## Verificação

Checagens estáticas e de banco descritas em `docs/KITCHEN_MODE_QA_PLAN.md`: nenhum campo
proibido na RPC ou no frontend, `anon` sem execução, lint e tipos limpos.

**Limitação honesta:** o banco está sem pedidos, então fila povoada, contadores e disputas de
concorrência não foram exercitados com dados reais, e nenhum pedido fictício foi inserido para
forjar evidência. O roteiro de execução está pronto no plano de QA.

## Fora do escopo (mantido fora)

Impressão, som, push, atribuição de entregador, estoque, edição de pedido, relatórios,
dados financeiros e qualquer PII.
