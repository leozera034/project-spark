# Modo Cozinha — Arquitetura (Fase 17)

O Modo Cozinha é uma **projeção operacional** do painel de pedidos, não um segundo sistema.
Ele não possui máquina de estados própria, não escreve direto em `public.orders` e não
consulta o catálogo atual.

## Camadas

| Camada | Arquivo / objeto | Responsabilidade |
| --- | --- | --- |
| Leitura | `public.list_my_kitchen_orders(_store_id)` | projeção mínima, `SECURITY DEFINER`, exige `kitchen.view` |
| Ações permitidas | `private.kitchen_allowed_actions(status, store)` | decide no servidor quais botões existem |
| Transição | `private.transition_store_order` (Fase 16) | única implementação de mudança de estado |
| Wrappers | `public.start_store_order_preparation`, `public.mark_store_order_ready` | reuso integral da Fase 16 |
| Sinal | `public.store_order_realtime_events` | envelope mínimo, sem conteúdo do pedido |
| Cliente | `src/kitchen/{types,api,useKitchenOrders}.ts` | contratos, RPC e estado |
| Tela | `src/routes/app/loja/cozinha.tsx` | duas filas, cards grandes, uma ação por card |

## Rota

`/app/loja/cozinha`, dentro do layout `/app/loja` que já aplica `RequireAuth`,
`RequirePasswordChangeCompleted` e `RequireEnvironment="store"`. O guarda de frontend é
conveniência; a decisão real é a permissão verificada dentro da RPC.

## O que a cozinha não faz

Aceitar, recusar, cancelar, concluir retirada, atribuir entregador, criar entrega, imprimir,
tocar som, enviar push, editar conteúdo do pedido ou ver qualquer valor.
