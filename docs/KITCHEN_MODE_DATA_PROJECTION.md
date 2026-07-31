# Modo Cozinha — Projeção de dados (Fase 17)

Fonte: `public.list_my_kitchen_orders(_store_id uuid default null)`.

## Campos devolvidos

Envelope: `storeId`, `serverNow`, `orders[]`.

Por pedido:

```
orderId
orderNumber
status                        -- apenas 'aceito' ou 'em_preparo'
version
createdAt
acceptedAt
preparationStartedAt          -- derivado de order_status_history
estimatedPreparationMinutes
serverNow
isDelayed
delayMinutes
urgencyLevel                  -- normal | attention | delayed
allowedActions                -- subconjunto de start_preparation, mark_ready
items[]
```

Por item:

```
itemId
displayOrder                  -- order_items.sort_order congelado
quantity
measurementUnit               -- order_items.pricing_unit
productName
variantName
note                          -- observação do item, texto simples
optionGroups[]
```

Por opção: `groupName`, `itemName`, `quantity`, `portionLabel`.

`portionLabel` é derivado do próprio snapshot: quando as quantidades de um grupo somam mais de
um, cada linha vira `quantidade/soma` (`3/4 Calabresa`, `1/4 Muçarela`). Nenhuma regra atual do
catálogo participa do cálculo.

## Campos proibidos

Não existem na projeção nem nos tipos do frontend:

`customerName`, `customerFirstName`, `phone`, `customer_phone`, `address`, `street`, `number`,
`complement`, `referencePoint`, `neighborhood`, `latitude`, `longitude`, `fulfillment`,
`payment`, `paymentMethod`, `paymentLabel`, `changeFor`, `subtotal`, `deliveryFee`, `discount`,
`total`, `minimumOrderAmount`, `unitPrice`, `lineTotal`, `commission`, `courierAmount`,
`billing`, `subscription`, `plan`, `trackingToken`, `idempotencyKey`, `internalNote`,
`reasonCode`, `customerVisibleMessage`, `courier`.

A ausência é estrutural: a RPC nunca seleciona essas colunas. Nada é escondido por CSS.

## Snapshots

Nome de produto, variação, opções, quantidades, unidade e observações vêm de
`order_items` e `order_item_options`, congelados na Fase 14. Alterar o catálogo depois não muda
um pedido que já está na cozinha, e nenhum item aparece como “produto removido”.

## Consultas e custo

Uma única consulta por atualização, com `LATERAL` para o início de preparo e subconsultas
agregadas para itens e opções. Índices usados:
`orders(store_id, status, accepted_at)`, `order_items(store_id, order_id, sort_order)`,
`order_item_options(store_id, order_item_id)`, `order_status_history(store_id, order_id, created_at)`.
