# Fato Canônico de Entrega Concluída

## Definição
Uma entrega é considerada concluída quando satisfaz simultaneamente os seguintes critérios:
1. `order.fulfillment_type = 'delivery'`
2. `order.status = 'entregue'`
3. `delivery.status = 'concluida'`
4. `delivery.completed_at IS NOT NULL`
5. `delivery.courier_id IS NOT NULL`

## Regra de Contagem
- **Unicidade:** Cada `delivery_id` conta exatamente 1 vez.
- **Responsável:** A contagem é atribuída ao entregador (`courier_id`) registrado no momento da conclusão.
- **Exclusão:** Trocas de entregador anteriores à conclusão não recebem contagem para a entrega final.
- **Financeiro:** Nenhum dado financeiro (taxas, valores, comissões) é incluído no fato.
