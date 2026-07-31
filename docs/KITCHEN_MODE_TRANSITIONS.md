# Modo Cozinha — Transições (Fase 17)

Nenhuma função de transição foi criada. A cozinha chama exatamente os wrappers da Fase 16,
que delegam ao helper único `private.transition_store_order`.

| Ação | Wrapper | Permissão revalidada | Origem | Destino (decidido no servidor) |
| --- | --- | --- | --- | --- |
| Iniciar preparo | `public.start_store_order_preparation` | `orders.start_preparation` | `aceito` | `em_preparo` |
| Marcar como pronto | `public.mark_store_order_ready` | `orders.mark_ready` | `em_preparo` | `aguardando_retirada` (retirada) ou `pronto` (entrega) |

O navegador envia apenas `store_id`, `order_id` e `expected_version`. Não existe
`new_status`, `target_status`, `force_status` nem `skip_validation` em nenhum ponto do código.
A cozinha nem sabe a modalidade do pedido: o ramo correto é escolhido pelo banco.

## Efeitos de cada transição

1. `UPDATE` condicional por `store_id`, `version` e `status` de origem.
2. Linha em `public.order_status_history` com `action`, `from_status`, `to_status` e ator.
3. Linha em `public.audit_logs` com `order.preparation_started` ou `order.marked_ready`.
4. Sinal em `public.store_order_realtime_events` com a nova versão.
5. Retorno com `status`, `version` e `allowedActions`.

Como o histórico é o canônico do painel, o acompanhamento público do cliente muda junto:
`preparing` ao iniciar e `ready_for_pickup` / o passo de entrega ao marcar pronto.

## Erros possíveis

`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VERSION_CONFLICT`, `INVALID_TRANSITION`.
Nenhum deles é retentado automaticamente pela tela.
