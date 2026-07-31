# Modo Cozinha — Acessibilidade e legibilidade (Fase 17)

Meta: WCAG AA e leitura confortável a alguns metros.

## Estrutura

- `<main>` com `<h1>` “Cozinha”; cada fila é uma `<section>` rotulada com `<h2>`.
- Filas são listas (`<ul>/<li>`); cada pedido é um `<article>` com `<h3>` “Pedido nº N”.
- Abas do mobile usam `role="tablist"` / `role="tab"` com `aria-selected`.
- Avisos de conexão, cancelamento externo e conflito usam `role="status"`.

## Tamanhos efetivos

| Elemento | Tamanho |
| --- | --- |
| Número do pedido | 28 px |
| Nome do produto | 20 px |
| Opções e porções | 16 px |
| Observação | 16 px, negrito, com borda lateral |
| Ação principal | 18 px em botão de 52 px de altura |

Preferimos rolagem a reduzir texto: nenhum card encolhe para caber mais pedidos.

## Cor não é o único sinal

Urgência combina texto (“Acima do tempo previsto”), ícone de alerta, borda de 2 px e cor de
token. Nada pisca, nada usa neon, glow ou gradiente decorativo, e `prefers-reduced-motion`
continua respeitado pelas regras globais.

## Teclado e leitor de tela

Foco visível em todos os controles, ordem natural, botões com rótulo explícito. O relógio
atualiza a cada 15 segundos em texto comum, **fora** de região viva, para não ser anunciado
repetidamente; apenas mudanças de fila e conflitos são anunciados. Zoom de 200% mantém o
layout em uma coluna sem rolagem horizontal.
