# Fase 14 — Checkout e criação segura do pedido

## Escopo entregue
- Telefone obrigatório em entrega e retirada, normalizado no servidor (D-061).
- Forma de pagamento informativa, lida da configuração real da loja, com troco somente quando a forma exige.
- Revisão final com recálculo autoritativo: nenhum preço, taxa ou total enviado pelo navegador é aceito.
- Criação transacional do pedido com snapshots de endereço, bairro, pagamento e itens.
- Idempotência por chave de envio, com repetição segura e detecção de conflito quando o conteúdo muda.
- Numeração sequencial por loja e token público de acompanhamento gerado no servidor.
- Tela de confirmação com número do pedido e resumo do que foi enviado.

## Arquivos principais
- `src/lib/checkout-contracts.ts` — contratos de entrada, client-safe.
- `src/lib/checkout.server.ts` — pagamento e submissão, servidor-only.
- `src/routes/api/public/storefront/$slug/pagamentos.ts` — formas de pagamento ativas.
- `src/routes/api/public/storefront/$slug/pedidos.ts` — criação do pedido.
- `src/storefront/checkout/*` — tipos, mensagens, armazenamento local e acesso de rede.
- `src/routes/loja/$slug/checkout.tsx` — checkout.
- `src/routes/loja/$slug/pedido-enviado.tsx` — confirmação.

## Banco
- `orders` ganhou `request_hash`, `payment_method_kind`, `customer_phone_display` e `minimum_order_amount`.
- `private.normalize_phone` e `private.address_fingerprint` padronizam telefone e identidade de endereço.
- `public.storefront_submit_order` concentra toda a criação: valida atendimento, revalida cada linha pelo motor canônico da Fase 10, aplica pedido mínimo, cria cliente e endereço quando necessário e fecha os totais.
- O pedido nasce com totais zerados e só recebe subtotal, taxa e total depois que todas as linhas são recalculadas, respeitando a checagem de consistência de totais.

## Postura de segurança
- A função de criação é `SECURITY DEFINER` e executável apenas pela role de serviço; o navegador nunca fala direto com ela.
- Nenhum total, taxa ou preço vem do aparelho.
- Chave de idempotência com verificação de conteúdo evita pedido duplicado e evita reaproveitar uma chave para outro pedido.
- Trava por loja garante numeração sem colisão em envios simultâneos.
- Nenhum dado sensível do cliente é gravado no armazenamento local além do recibo mínimo do último envio.

## Verificações executadas
- Envio válido, reenvio idêntico (respondido como repetição), conflito de chave, pedido abaixo do mínimo e telefone inválido.
- Dados de teste removidos e abertura manual da loja de demonstração desligada.

## Fora de escopo
- Painel da loja recebendo o pedido, tempo real, impressão e acompanhamento pelo cliente ficam para as fases seguintes.
- Pedido agendado permanece pós-MVP (D-062).
