# Transição de marca — COMANDIVA

Data: 2026-08-18

## Decisão

A identidade pública do produto passa de **Pediu Aqui** para **Comandiva**.

O titular informou que o pedido da marca **COMANDIVA** foi protocolado no INPI. Este documento registra apenas a decisão interna do produto; não afirma deferimento, concessão ou registro definitivo da marca.

## Estado atual

- Nome público: **Comandiva**.
- Wordmark: tipográfico e transitório, até existir identidade visual definitiva.
- Domínio próprio: ainda não adquirido.
- Origem pública temporária: `https://shark-cardapio.lovable.app`.
- O cadastro público não deve exibir preços, trial ou condições comerciais legadas enquanto não houver catálogo canônico de planos no backend de produção.

## Identificadores técnicos congelados por compatibilidade

Os itens abaixo **não devem ser renomeados apenas por branding** sem migration/rollout específico, porque fazem parte da infraestrutura ou de integrações existentes:

- repositório GitHub `leozera034/project-spark`;
- slug/hostname Lovable `shark-cardapio`;
- project id Lovable `ac064684-e750-45e3-8b8f-80f4dd7f5eb7`;
- Supabase project ref externo `ypgteuxzgqmkkkpvibhi`;
- nomes de Edge Functions existentes, incluindo `pediu-backend-api` e `pediu-public-support`;
- migrations históricas, nomes de funções, logs e documentos históricos que registrem fatos anteriores à mudança de marca.

Renomear qualquer um desses itens exige análise de dependências, rollout compatível e rollback definido.

## Assets legados

Arquivos em `public/brand/` que ainda contenham a marca anterior permanecem no repositório por segurança até a nova identidade visual estar pronta. Eles não devem ser tratados como identidade pública vigente.

A remoção será feita somente após inventário de referências e substituição de favicon, PWA icons, Open Graph/Twitter cards, ilustrações e demais superfícies visuais.

## Próximas etapas de marca

1. Criar identidade visual definitiva da Comandiva.
2. Substituir todos os assets sociais/PWA/favicons que ainda tenham elementos da marca antiga.
3. Adquirir domínio próprio quando financeiramente possível.
4. Migrar canonical URLs, redirects de Auth, recovery e smoke tests somente após o domínio estar sob controle.
5. Configurar domínio de e-mail próprio e SMTP antes de liberar cadastro comercial amplo.
6. Depois do domínio, avaliar aliases/renomeação de identificadores técnicos sem downtime.

## Regra de segurança

**Branding público pode mudar imediatamente; identificadores técnicos não.** Nenhuma limpeza nominal deve comprometer autenticação, Edge Functions, banco, deploy, links públicos ou histórico de migrations.
