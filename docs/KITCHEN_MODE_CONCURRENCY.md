# Modo Cozinha — Concorrência (Fase 17)

Toda ação leva a versão que estava na tela. O `UPDATE` é condicional por
`store_id`, `version` e status de origem; quem perde a corrida recebe `VERSION_CONFLICT`.

## Regra da tela

- Nenhuma transição otimista: o card só se move depois da resposta do servidor.
- Um único pedido em ação por vez (`pendingId`), o que anula clique duplo.
- Conflito recarrega a projeção e mostra: **“Este pedido foi atualizado em outra tela.”**
- A ação nunca é repetida automaticamente.

## Disputas cobertas

| Cenário | Resultado |
| --- | --- |
| Cozinha A inicia × Cozinha B inicia | uma vence; a outra recebe conflito |
| Cozinha A marca pronto × Cozinha B marca pronto | uma vence; a outra recebe conflito |
| Cozinha inicia × painel cancela | apenas uma transição é aplicada; o pedido cancelado sai da fila |
| Cozinha marca pronto × painel cancela | idem |
| Painel inicia × cozinha inicia | idem, mesma função, mesma trava |
| Painel marca pronto × cozinha marca pronto | idem |
| Loja A × Loja B | a segunda nem enxerga o pedido (`NOT_FOUND`) |

Em todos os casos: uma única linha de histórico, uma única linha de auditoria, versão
incrementada uma única vez e acompanhamento público coerente. Nenhum estado impossível é
alcançável, porque o destino é derivado do estado de origem dentro da mesma transação.
