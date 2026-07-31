# Fase 13 — Carrinho público real, persistente e recalculado no servidor

## Escopo entregue
- Carrinho local isolado por slug (`pediu-aqui:cart:v1:{slug}`), com validade de sete dias, limite de quarenta linhas e espelho em memória quando o armazenamento estiver bloqueado.
- Adição, edição, duplicação por assinatura, alteração de quantidade, observação, remoção e esvaziamento com confirmação.
- Cotação do carrinho inteiro em uma única chamada pública, reutilizando o motor canônico de preço (Fase 10) e a validação de atendimento (Fase 12).
- Barra flutuante no cardápio e tela dedicada do carrinho em `/loja/{slug}/carrinho`.
- Detecção explícita de item esgotado, item fora do cardápio, montagem inválida e mudança de preço.

## Arquivos principais
- `src/lib/cart-contracts.ts` — contrato de entrada, client-safe.
- `src/lib/cart.server.ts` — cotação servidor-only.
- `src/routes/api/public/storefront/$slug/carrinho/cotacao.ts` — endpoint público com CORS, limite de corpo e limite de frequência.
- `src/storefront/cart/*` — tipos, validação, armazenamento, mensagens, acesso de rede e provider.
- `src/routes/loja/$slug/route.tsx` — layout com wizard e carrinho acima das telas.
- `src/routes/loja/$slug/index.tsx` — cardápio.
- `src/routes/loja/$slug/carrinho.tsx` — carrinho.

## Postura de segurança
- Nenhum preço enviado pelo navegador é aceito; tudo é recalculado no servidor.
- O corpo da cotação não carrega nome, endereço, telefone nem `store_id`.
- Nenhuma URL assinada de imagem é gravada no armazenamento local.
- Todo conteúdo lido do aparelho passa por validação de esquema, com descarte de chaves perigosas e de documentos de outra loja ou expirados.
- Nenhuma linha de carrinho é gravada no banco nesta fase.

## Fora de escopo
- Checkout, telefone do cliente, criação de pedido e pagamento permanecem na Fase 14 em diante.
