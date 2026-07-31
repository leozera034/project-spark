# Modo Cozinha — Permissões (Fase 17)

O catálogo `public.app_permission` já continha as ações da cozinha desde a Fase 07.
Nenhuma permissão nova foi criada.

| Permissão | Papéis (`private.permission_roles`) |
| --- | --- |
| `kitchen.view` | proprietário, gerente, cozinha |
| `kitchen.start_preparation` | proprietário, gerente, cozinha |
| `kitchen.mark_ready` | proprietário, gerente, cozinha |
| `orders.start_preparation` | proprietário, gerente, atendente, cozinha |
| `orders.mark_ready` | proprietário, gerente, atendente, cozinha |

## Como cada camada decide

- **Abrir a fila:** `list_my_kitchen_orders` exige `kitchen.view` na loja resolvida.
- **Ver o botão:** `private.kitchen_allowed_actions` exige `kitchen.*` **e** a permissão
  correspondente de pedidos.
- **Executar:** `private.transition_store_order` revalida `orders.start_preparation` /
  `orders.mark_ready`. Um cliente que forje a chamada não passa.

## Resultado por perfil

| Perfil | Fila | Iniciar preparo | Marcar pronto | Painel completo |
| --- | --- | --- | --- | --- |
| cozinha | sim | sim | sim | não (`orders.view_queue` negada) |
| proprietário | sim | sim | sim | sim |
| gerente | sim | sim | sim | sim |
| atendente | **não** (`kitchen.view` negada) | pelo painel | pelo painel | sim |
| entregador | não | não | não | não |
| admin da plataforma | não | não | não | não |
| perfil inativo / sem papel / sem sessão | não | não | não | não |
| usuário da Loja A na Loja B | não | não | não | não |

Nenhum `GRANT` de `SELECT` direto sobre `public.orders` foi concedido ao papel cozinha: o
acesso é exclusivamente pela RPC.

## Sinais em tempo real

A policy de `public.store_order_realtime_events` passou a aceitar
`orders.view_queue` **ou** `kitchen.view`, sempre da mesma loja. Continua sem `USING (true)`.
