# Fase 15 — Acompanhamento público e seguro do pedido

**Data:** 2026-07-31
**Escopo:** token de acompanhamento, projeção sanitizada, linha do tempo e atualização por polling.
**Fora de escopo:** Realtime, chat com a loja, avaliação, reenvio de pedido, painel da loja.

## Auditoria de entrada (Fase 14)

| Item | Situação encontrada | Ação |
| --- | --- | --- |
| `orders.public_tracking_token` | gravado em texto aberto, `NOT NULL`, com default no banco | substituído por `tracking_token_hash` (SHA-256, único); coluna bruta zerada, sem default e sem `NOT NULL` |
| Retorno do token ao cliente | devolvido no envio do pedido | mantido: agora é a única exibição possível |
| Funções `private` | inacessíveis a `anon`/`authenticated` | confirmado; nenhuma nova concessão |
| Projeção pública | inexistente | criada `private.get_public_order_tracking` |

## Modelo de segurança

- **Credencial:** o token bruto (48 hex) só existe no aparelho do cliente e no link. O banco guarda o hash.
- **Execução:** `private.get_public_order_tracking` e a ponte `public.storefront_order_tracking` são `SECURITY DEFINER`, `STABLE`, com `search_path` fixo, revogadas de `PUBLIC`, `anon` e `authenticated`; apenas `service_role` executa.
- **Transporte:** o token viaja no corpo de um `POST`, nunca na query string — não entra em log de proxy nem em `Referer`. A resposta é `no-store` e `x-robots-tag: noindex, nofollow`.
- **Projeção:** número, situação pública, modalidade, bairro, itens congelados, totais, pagamento e linha do tempo. **Não** projeta: `id`, `store_id`, `customer_id`, endereço completo, telefone do cliente, notas internas, dados de entregador ou enum interno de status.
- **Limite:** 40 consultas por minuto por instância, por impressão digital derivada; nenhum IP bruto é persistido.
- **Imagens:** a logo é assinada a cada resposta, com validade de 10 minutos, e nunca é gravada.

## Entregas

| Camada | Arquivo |
| --- | --- |
| Contratos e textos | `src/lib/tracking-contracts.ts` |
| Leitura servidor-only | `src/lib/tracking.server.ts` |
| Endpoint público | `src/routes/api/public/storefront/pedido/status.ts` |
| Acesso do navegador | `src/storefront/tracking/tracking.api.ts` |
| Polling | `src/storefront/tracking/useOrderTracking.ts` |
| Tela | `src/routes/pedido/$token.tsx` |
| Ligação do checkout | `src/routes/loja/$slug/pedido-enviado.tsx` |

## Ritmo do polling

| Situação | Intervalo |
| --- | --- |
| recebido, confirmado, saiu para entrega, pronto para retirada | 12 s |
| em preparo, aguardando entregador | 30 s |
| falha de rede | dobra a cada falha, até 120 s |
| estado final | polling encerrado |

Aba oculta e aparelho offline não consultam; a volta ao foco dispara uma consulta imediata.

## Limitação conhecida

Reenvio idempotente cujo primeiro retorno se perdeu não recupera o link de acompanhamento, porque o token não é recuperável por design (D-066). O cliente recebe número, totais e situação do pedido normalmente.

## Rollback

1. `DROP TRIGGER orders_hash_tracking_token ON public.orders;`
2. `DROP FUNCTION public.storefront_order_tracking(text, text);`
3. `DROP FUNCTION private.get_public_order_tracking(text, text);`
4. `DROP FUNCTION private.public_order_status_code(public.order_status);`
5. `DROP INDEX public.orders_tracking_token_hash_key;` e `ALTER TABLE public.orders DROP COLUMN tracking_token_hash;`

Tokens antigos não voltam: o passo de hash é irreversível por definição.
