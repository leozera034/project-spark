# Modo Cozinha — Privacidade (Fase 17)

Princípio: **necessidade operacional**. A cozinha prepara itens; ela não contata o cliente nem
executa a entrega, então não recebe contato, endereço, modalidade, pagamento nem valores —
mesmo sendo uma rota autenticada.

## Garantias

- A projeção não seleciona nenhuma coluna pessoal ou financeira (ver
  `KITCHEN_MODE_DATA_PROJECTION.md`).
- Os tipos do frontend (`src/kitchen/types.ts`) não declaram esses campos.
- O evento de tempo real carrega apenas loja, pedido, tipo e versão.
- Título da página: **“Cozinha | Pediu Aqui”**, sem número nem item de pedido.
- Nenhum dado do pedido em `console`, log, analytics, breadcrumb ou notificação do sistema.
- Observações são renderizadas como texto simples, nunca como HTML.

## Armazenamento local

Nada é persistido. A projeção vive apenas no cache em memória do React Query, que é descartado
ao sair da rota, ao trocar de loja e ao encerrar a sessão. Não há `localStorage` nem
`sessionStorage` no Modo Cozinha.

## Sessão e permissão

Sessão expirada, perfil inativado, permissão removida ou vínculo encerrado: o canal é fechado,
o fallback para, a projeção some da tela, as ações ficam bloqueadas e o guarda redireciona.
Nenhum pedido permanece visível e não é preciso recarregar a página.
