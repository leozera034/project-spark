# Fase 16 — Relatório (registro retroativo)

Este documento foi criado na Fase 17 porque não havia sido gerado no encerramento da Fase 16.
Ele registra o que existe hoje no código e no banco, revalidado no início desta fase.

## Bloco A — Tracking

- A rota `/pedido/$token` foi neutralizada: não consulta nada e apenas orienta o cliente.
- O acompanhamento vive em `/loja/{slug}/acompanhar`, com o token apenas no **fragmento**
  (`#token`), que não é enviado ao servidor nem gravado em log de acesso.
- O fragmento é lido uma vez e removido da barra de endereços via `history.replaceState`.
- No banco só existe o **hash SHA-256** do token (D-066); a consulta pública passa por
  `private.get_public_order_tracking`, com projeção sanitizada e status traduzido (D-067).
- Revalidação nesta fase: nenhum ponto do código de tracking escreve o token em `console`,
  em analytics ou em atributo de link.

## Bloco B — Painel de pedidos

- `public.orders` ganhou `version`, `reason_code` e colunas de auditoria.
- Transições concentradas em `private.transition_store_order`, com `UPDATE` condicional por
  `store_id`, `version` e status de origem.
- Wrappers públicos: aceitar, recusar, iniciar preparo, marcar pronto, concluir, cancelar.
- Todo movimento grava `order_status_history` e `audit_logs`.
- `public.store_order_realtime_events` carrega apenas loja, pedido, tipo e versão, com policy
  restrita à própria loja — revalidada nesta fase, sem `USING (true)`.

## Pendência herdada

O banco ainda não possui pedidos reais, então o painel e o tracking não têm evidência de
execução ponta a ponta. O roteiro está em `docs/KITCHEN_MODE_QA_PLAN.md`, que cobre painel e
cozinha na mesma passagem.
