# Modo Cozinha — Tempo e urgência (Fase 17)

## Timestamps usados

| Campo | Origem |
| --- | --- |
| `createdAt` | `orders.created_at` |
| `acceptedAt` | `orders.accepted_at` |
| `preparationStartedAt` | maior `created_at` em `order_status_history` com `to_status = 'em_preparo'` |
| `estimatedPreparationMinutes` | `orders.eta_minutes` congelado |
| `serverNow` | `now()` da própria consulta |

Nenhum campo de tempo decorrido é gravado. Não existe `elapsed_minutes` no banco.

## Relógio da tela

O navegador guarda um **offset** (`serverNow − Date.now()`) na primeira resposta e atualiza o
mostrador a cada 15 segundos apenas com esse offset. Não há requisição por segundo, e o relógio
do aparelho, adiantado ou atrasado, não altera o que é exibido.

Referência do contador: início do preparo quando existe, senão o aceite, senão a criação.

## Urgência derivada

Calculada no servidor a cada consulta, nunca persistida:

| Nível | Regra |
| --- | --- |
| `normal` | dentro de 75% do tempo previsto |
| `attention` | passou de 75% do tempo previsto |
| `delayed` | passou do tempo previsto |

Base: `accepted_at` (ou `created_at`) mais `eta_minutes`, com 30 minutos como padrão quando a
loja não informou previsão. `isDelayed` e `delayMinutes` acompanham a mesma conta.

“Atrasado” **não é status**: o enum de pedidos continua intocado.
