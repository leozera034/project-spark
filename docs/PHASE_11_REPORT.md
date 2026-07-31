# Fase 11 — Cardápio público real, seguro e otimizado

## O que foi entregue

- **Rota pública** `/loja/$slug`, renderizada no servidor, com resolução de loja
  por slug, identidade visual aplicada por token de marca, estado aberto/fechado
  calculado no servidor (timezone + `store_hours`), busca sem acento, navegação
  por categorias e ficha de produto em painel (`?produto=<uuid>`).
- **Camada de servidor**: `src/lib/storefront.server.ts` (único ponto que fala com
  o banco em nome de visitante anônimo) e `src/lib/storefront.functions.ts`
  (server functions com validação Zod).
- **Endpoints HTTP públicos** em `src/routes/api/public/storefront/`:
  - `GET /api/public/storefront/$slug` — loja + catálogo
  - `GET /api/public/storefront/$slug/produtos/$productId` — ficha do produto
  - `POST /api/public/storefront/$slug/preco` — preço canônico
- **RPCs** `storefront_store`, `storefront_catalog`, `storefront_product`,
  `storefront_price`, todas `SECURITY DEFINER` e concedidas apenas ao
  `service_role`.

## Postura de segurança

| Controle | Estado |
|---|---|
| Policies `anon` no catálogo | nenhuma — deny-by-default preservado |
| `anon` com USAGE no schema `private` | revogado |
| Cliente privilegiado | importado dentro do handler, nunca no escopo do módulo |
| `store_id` | sempre resolvido pelo slug no servidor |
| Projeção de colunas | explícita; `document`, `legal_name`, `email` e coordenadas fora do payload |
| Imagens | apenas URLs assinadas de 30 min; buckets seguem privados |
| Entrada | Zod: slug normalizado, UUIDs, teto de 60 seleções, corpo de 8 KB |
| Erros | códigos genéricos; detalhe apenas no log do servidor |

## Verificações executadas

- Preço de produto simples: `24,90 × 2 = 49,80` conferido pelo endpoint.
- Opção forjada de outra loja: rejeitada com `invalid_selection`.
- Produto de outra loja no slug errado: rejeitado com `product_not_found`.
- Slug inexistente: `404`.
- HTML entregue não contém dados cadastrais sensíveis da loja.

## Correção aplicada durante a fase

O motor interno `private.calculate_configured_product_price` espera as seleções
no formato agrupado (`group_id` + `items[]`), enquanto a API pública recebe uma
lista plana. A RPC `storefront_price` passou a converter os formatos e a devolver
`validation_errors`, que antes eram silenciosamente descartados.
