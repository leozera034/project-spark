# Auditoria 360° da Área do Lojista — Comandiva

> Fonte de verdade viva da auditoria e implementação do módulo do lojista.
>
> **Data de abertura:** 2026-08-22  
> **Repositório:** `leozera034/project-spark`  
> **Baseline auditado:** `main` em `418b2fe116c59fcbc2354d84265b2ff61e2263f0`  
> **Branch de trabalho:** `audit/lojista-360-2026-08-22`  
> **Supabase alvo confirmado:** `ypgteuxzgqmkkkpvibhi` (`pediu-aqui`, `sa-east-1`, ACTIVE_HEALTHY)

## Estado da auditoria

**Classificação atual: INCONCLUSIVA — auditoria em andamento.**

A área do lojista não deve ser declarada pronta para produção com base apenas na existência de telas, RPCs, tabelas ou componentes. O critério desta auditoria é E2E: interface → ação → validação → autorização → regra de negócio → persistência → efeitos em módulos dependentes → feedback → tratamento de erro → idempotência/concorrência quando aplicável.

### Regras de evidência

- **Fato observado:** comprovado em código, banco, configuração, log ou teste executado.
- **Inferência:** conclusão consistente com evidências, mas ainda sem prova E2E.
- **Hipótese:** explicação ainda não confirmada.
- **Recomendação:** ação proposta, não tratada como implementação concluída.
- Um item só recebe `✅ FUNCIONAL` após prova suficiente do ciclo completo.

### Legenda funcional

- ✅ FUNCIONAL
- 🟡 FUNCIONAL COM RESSALVAS
- 🟠 INCOMPLETO
- 🔴 QUEBRADO
- ⚪ SOMENTE VISUAL
- 🔵 NÃO IMPLEMENTADO
- 🟣 DUPLICADO
- ⚫ OBSOLETO
- ❓ NÃO FOI POSSÍVEL VALIDAR

### Prioridade

- **P0 — CRÍTICO:** segurança, perda financeira, corrupção/vazamento de dados, pedido impossível de operar, pagamento incorreto, indisponibilidade estrutural.
- **P1 — ALTO:** fluxo principal, pedidos, cardápio, entrega, pagamento, autenticação e integrações essenciais.
- **P2 — MÉDIO:** UX operacional, relatórios, configurações, automações e inconsistências não bloqueantes.
- **P3 — BAIXO:** refinamentos, estética e melhorias opcionais.

---

# 1. Arquitetura encontrada

## 1.1 Stack confirmada

**Fato observado no `package.json`:**

- React 19
- TypeScript 5.8
- TanStack Start + TanStack React Router
- TanStack Query
- Supabase JS
- Supabase/Postgres como backend principal
- Tailwind CSS 4
- Zod
- Recharts
- Radix UI
- Vite 8
- Bun lockfile

Scripts de qualidade existentes:

- `lint`
- `typecheck`
- `test:hygiene`
- `test:db-static`
- `test:smoke`
- `build`
- `check` agrega higiene + contrato estático de banco + lint + typecheck + build + smoke.

## 1.2 Modelo arquitetural observado

O frontend usa TanStack Router com rotas por arquivo. Operações sensíveis do lojista usam predominantemente RPCs Postgres expostas pelo Supabase. Muitas tabelas operacionais têm RLS habilitada e nenhuma policy direta, o que é compatível com uma arquitetura **RPC-only / deny-by-default para Data API direta**, desde que todas as RPCs privilegiadas executem autorização interna corretamente.

**Importante:** `RLS enabled + zero policies` não é, isoladamente, uma vulnerabilidade; tende a negar acesso direto. Nesta base, mudar isso criando policies genéricas sem mapear o contrato RPC pode ampliar a superfície de acesso e é proibido nesta auditoria sem justificativa específica.

## 1.3 Autenticação e autorização observadas

A shell `/app/loja` aplica:

1. `RequireAuth`
2. `RequirePasswordChangeCompleted`
3. `RequireEnvironment environment="store"`

No banco, funções críticas analisadas usam permissões internas como `private.has_permission(...)`, `private.require_permission(...)`, `private.resolve_store(...)` e checagens explícitas de vínculo `user_roles.store_id`.

### Resultado preliminar do teste mental de IDOR

**Fato observado:** nas funções já inspecionadas, alterar `_store_id` manualmente não basta para acessar outra loja porque:

- `private.has_permission(permission, target_store_id)` exige role ativa do usuário para a loja alvo;
- pedidos são buscados por `id` **e** `store_id`;
- catálogo usa `private.require_permission(..., resolved_store)` e filtra entidades por `store_id`;
- administração exige permissão `platform.*` e role `admin_plataforma` sem `store_id`.

**Classificação atual:** 🟡 FUNCIONAL COM RESSALVAS, porque ainda falta inventariar todas as RPCs `SECURITY DEFINER`, não apenas as principais.

## 1.4 Supabase / produção

Projeto confirmado: `ypgteuxzgqmkkkpvibhi`, nome `pediu-aqui`, região `sa-east-1`, Postgres 17, estado `ACTIVE_HEALTHY` em 2026-08-22.

A auditoria de produção existente de 2026-08-21 já registrava piloto controlado com ressalvas e apontava como pendências relevantes Stripe Connect E2E, funções temporárias de bootstrap/QA, contratos de banco no CI e proteção contra senhas vazadas.

---

# 2. Mapa do módulo lojista

```text
LOJISTA
├─ Shell / autenticação / billing gate
├─ Visão geral
├─ Pedidos
│  ├─ fila / busca / filtros
│  ├─ detalhe / histórico
│  ├─ aceitar / recusar
│  ├─ iniciar preparo
│  ├─ marcar pronto
│  ├─ cancelar
│  ├─ concluir retirada
│  └─ atribuir entregador
├─ Cozinha
├─ Devoluções
├─ Cardápio
│  ├─ produtos
│  ├─ categorias
│  ├─ opções/adicionais
│  └─ serviço/configuração avançada
├─ Entregadores
│  ├─ lista
│  ├─ cadastro
│  └─ detalhe
├─ Smart Delivery
├─ Crescimento / CRM / marketing
├─ Módulos / add-ons
├─ WhatsApp
├─ Plano e assinatura
├─ Relatórios de entregas
└─ Configurações
   ├─ dados
   ├─ identidade
   ├─ endereço/localização
   ├─ horários
   ├─ pagamentos
   ├─ bairros/entrega
   └─ atendimento

INTEGRAÇÕES TRANSVERSAIS
├─ Cliente / storefront `/loja/$slug/*`
├─ Checkout / criação de pedido
├─ Acompanhamento público do pedido
├─ Entregador `/app/entregador/*`
├─ Administração `/admin/*`
├─ Stripe / billing / payouts
├─ WhatsApp / Evolution / Meta
├─ E-mail / Resend
├─ Push / FCM
├─ Maps / routing / Smart Delivery
└─ Auditoria / eventos / relatórios
```

---

# 3. Rotas

## 3.1 Rotas do lojista identificadas

- `/app/loja`
- `/app/loja/pedidos`
- `/app/loja/cozinha`
- `/app/loja/devolucoes`
- `/app/loja/plano`
- `/app/loja/whatsapp`
- `/app/loja/modulos`
- `/app/loja/crescimento`
- `/app/loja/smart-delivery`
- `/app/loja/cardapio`
- `/app/loja/cardapio/categorias`
- `/app/loja/cardapio/opcoes`
- `/app/loja/cardapio/servico`
- `/app/loja/cardapio/produtos`
- `/app/loja/cardapio/produtos/novo`
- `/app/loja/cardapio/produtos/$id`
- `/app/loja/configuracoes`
- `/app/loja/configuracoes/dados`
- `/app/loja/configuracoes/identidade`
- `/app/loja/configuracoes/endereco`
- `/app/loja/configuracoes/horarios`
- `/app/loja/configuracoes/pagamentos`
- `/app/loja/configuracoes/bairros`
- `/app/loja/configuracoes/atendimento`
- `/app/loja/entregadores`
- `/app/loja/entregadores/novo`
- `/app/loja/entregadores/$courierId`
- `/app/loja/relatorios/entregas`

## 3.2 Rotas transversais já identificadas

### Cliente / storefront

- `/loja/$slug`
- `/loja/$slug/carrinho`
- `/loja/$slug/checkout`
- `/loja/$slug/pedido-enviado`
- `/loja/$slug/acompanhar`
- `/pedido/$`

### Entregador

- `/app/entregador`
- `/app/entregador/entrega`
- `/app/entregador/historico`

### Administração

- `/admin`
- `/admin/lojas`
- `/admin/operacao`
- `/admin/observabilidade`
- `/admin/modulos`
- `/admin/servicos`
- `/admin/modelos-solicitados`

### API pública relevante

- `/api/public/storefront/$slug`
- `/api/public/storefront/$slug/preco`
- `/api/public/storefront/$slug/pedidos`
- `/api/public/storefront/$slug/pedido/status`
- `/api/public/storefront/$slug/pagamentos`
- `/api/public/storefront/$slug/atendimento`
- `/api/public/storefront/$slug/atendimento/validar`
- `/api/public/storefront/$slug/produtos/$productId`
- `/api/public/storefront/$slug/carrinho/cotacao`

### Gap de navegação preliminar

A shell principal inclui Visão geral, Pedidos, Cozinha, Cardápio, Crescimento, Módulos, Entregadores, Smart Delivery, Relatórios, Plano e Configurações. A rota `/app/loja/devolucoes` existe, mas **não aparece como item próprio no `NAV_ITEMS` da shell**. Ainda precisa ser verificado se ela é acessada contextualmente de Pedidos/Entregas ou se é rota órfã/invisível.

Status: 🟠 INCOMPLETO até confirmar caminho de acesso intencional.

---

# 4. Telas

Inventário de tela por tela iniciado. Nenhuma tela é considerada validada apenas pela existência da rota.

| Tela | Rota | Estado da inspeção |
|---|---|---|
| Shell do lojista | `/app/loja` | Inspeção de código iniciada |
| Visão geral | `/app/loja` | Pendente aprofundar |
| Pedidos | `/app/loja/pedidos` | Inspeção de código + RPC iniciada |
| Cozinha | `/app/loja/cozinha` | Pendente aprofundar |
| Devoluções | `/app/loja/devolucoes` | Pendente aprofundar |
| Cardápio | `/app/loja/cardapio` | Pendente aprofundar |
| Produtos | `/app/loja/cardapio/produtos/*` | Pendente aprofundar |
| Categorias | `/app/loja/cardapio/categorias` | Pendente aprofundar |
| Opções | `/app/loja/cardapio/opcoes` | Pendente aprofundar |
| Serviço | `/app/loja/cardapio/servico` | Pendente aprofundar |
| Entregadores | `/app/loja/entregadores/*` | Pendente aprofundar |
| Smart Delivery | `/app/loja/smart-delivery` | Pendente aprofundar |
| Crescimento | `/app/loja/crescimento` | Pendente aprofundar |
| Módulos | `/app/loja/modulos` | Pendente aprofundar |
| WhatsApp | `/app/loja/whatsapp` | Pendente aprofundar |
| Plano | `/app/loja/plano` | Pendente aprofundar |
| Relatórios | `/app/loja/relatorios/entregas` | Pendente aprofundar |
| Configurações | `/app/loja/configuracoes/*` | Pendente aprofundar |

---

# 5. Funcionalidades

## 5.1 Pedidos — evidência inicial

**Frontend observado:** `src/routes/app/loja/pedidos.tsx` usa queries/mutations de `@/store-orders/useStoreOrders` e APIs de entregador. Há:

- seleção de loja para usuário multi-loja;
- filas por status;
- busca;
- filtro entrega/retirada;
- filtro de atrasados;
- polling/realtime com indicador visual;
- loading, empty state e error state;
- detalhe do pedido;
- histórico;
- ações de transição;
- motivos obrigatórios em recusa/cancelamento;
- bloqueio visual durante mutation;
- versão otimista/controle de concorrência via `expectedVersion`;
- atribuição de entregador;
- impressão de pedido.

**Backend observado:** `src/store-orders/api.ts` não faz update local otimista das transições; chama RPCs atômicas e envia `expectedVersion`.

**Banco observado:** `private.transition_store_order(...)` valida autenticação, permissão por loja, existência do pedido na loja, versão, transição de status e motivos; persiste `orders`, grava `order_status_history` e `audit_logs`, cria delivery quando necessário e emite evento de loja.

**Classificação preliminar:** 🟡 FUNCIONAL COM RESSALVAS.

Ainda falta provar E2E:

- criação pública do pedido → aparecimento na fila;
- notificação sonora/WhatsApp/push sem duplicidade;
- atualização do cliente após cada status;
- ligação com entregador até conclusão;
- efeitos financeiros/settlement;
- comportamento de reconnect/retry em rede ruim;
- testes de duas abas/dois operadores concorrendo;
- atualização em produção após refresh.

---

# 6. Integrações com Cliente

Auditoria em andamento.

Fluxo alvo obrigatório:

```text
LOJISTA altera catálogo/configuração
→ banco persiste
→ storefront público consulta a mesma fonte autoritativa
→ cache/realtime/revalidação não mantém dado antigo
→ cliente vê a alteração
```

E no sentido inverso:

```text
CLIENTE cria/edita ação permitida
→ validação pública
→ pedido persistido de forma idempotente
→ lojista recebe na fila
→ evento/notificação é emitido
→ cliente acompanha o estado real
```

Pendências prioritárias: catálogo, disponibilidade, horários, entrega, checkout, pagamento e tracking.

---

# 7. Integrações com Entregador

**Fato observado:** ao marcar pedido de entrega como pronto, `private.transition_store_order` leva o pedido para `aguardando_entregador` e chama `private.ensure_delivery_for_order`. Atribuição usa `private.set_delivery_courier`, exige permissão `couriers.assign`, valida loja/pedido/entregador, versão da entrega, estado do pedido, disponibilidade e ausência de entrega ativa concorrente; persiste `deliveries`, `delivery_events`, `audit_logs` e emite evento.

**Classificação preliminar:** 🟡 FUNCIONAL COM RESSALVAS.

Ainda falta validar as ações do próprio entregador (aceite, chegada, retirada, início de rota, ocorrência, devolução e conclusão) e a propagação resultante para pedido/cliente/financeiro.

---

# 8. Integrações com Administrador

**Fato observado:** RPCs administrativas analisadas (`admin_suspend_store`, `admin_reactivate_store`) são `SECURITY DEFINER`, porém exigem `private.has_permission('platform.*', NULL)`. O helper `has_permission` restringe permissões `platform.*` a role ativa `admin_plataforma` com `store_id IS NULL`.

**Classificação preliminar:** 🟡 FUNCIONAL COM RESSALVAS.

Pendência: auditar todas as RPCs administrativas expostas a `authenticated`, principalmente billing, planos, addons, lojas, observabilidade e serviços, para garantir que nenhuma dependa apenas do papel `authenticated`.

---

# 9. Pedidos

## 9.1 Máquina de estados encontrada — parcial

Estados reais ainda serão inventariados diretamente do enum `public.order_status`. Transições já comprovadas em `private.transition_store_order`:

```text
aguardando_confirmacao
  ├─ accept → aceito
  └─ reject → recusado

aceito
  └─ start_preparation → em_preparo

em_preparo + retirada
  └─ mark_ready → aguardando_retirada

em_preparo + entrega
  └─ mark_ready → aguardando_entregador

aguardando_retirada + retirada
  └─ complete_pickup → retirado

cancel permitido a partir de:
aguardando_confirmacao | aceito | em_preparo | pronto | aguardando_retirada | aguardando_entregador
  → cancelado
```

### Observação a investigar

A função aceita `pronto` como estado cancelável, mas o trecho analisado de `transition_store_order` não produz `pronto` em `mark_ready`; para entrega produz `aguardando_entregador` e para retirada `aguardando_retirada`. Isso pode ser compatibilidade histórica ou estado produzido em outra função. **Não remover `pronto` até mapear todos os produtores/consumidores.**

---

# 10. Cardápio

**Fato observado:** o modelo `products` suporta mais que produto simples: disponibilidade, destaque, esgotado, janela por horário/dias, quantidade máxima, variantes, venda por unidade/medida, engine/capabilities/pricing rules e estoque/limite baixo.

**Fato observado:** `update_simple_product(...)` resolve a loja, exige `catalog.update`, valida nome/texto/preço, bloqueia concorrência por `updated_at`, garante categoria da mesma loja e audita a alteração.

**Pendência crítica de integração:** provar que storefront filtra corretamente `is_active/is_available`, `is_sold_out`, arquivamento, disponibilidade por horário/dia, estoque e variantes a partir da mesma regra autoritativa.

Status: 🟠 INCOMPLETO até a validação cliente ↔ lojista.

---

# 11. Entrega

O banco contém `deliveries` com versionamento, atribuição, aceite, retirada, início, conclusão, cancelamento, chegada à loja, rota, devolução e metadados. Existem `delivery_events` separados.

Status: 🟠 INCOMPLETO enquanto não for validada a máquina completa de entrega e sua sincronização com `orders`.

---

# 12. Financeiro

**Fato observado:** o pedido já possui `payment_status`, `paid_at`, `payment_provider`, `paid_amount_cents` e `refunded_amount_cents`.

**Fato observado:** `request_my_store_payout(...)` exige manager da loja ou admin da plataforma, exige idempotency key, calcula saldo disponível a partir de settlement entries, cria payout request, reserva settlements e distribui taxa de payout entre transfer items.

**Risco aberto já documentado em produção:** Stripe Connect do lojista ainda não foi provado E2E com conta real. Portanto, payout automático não pode ser classificado como funcional de produção apenas porque RPC/tabelas existem.

Status: 🟠 INCOMPLETO — **P0/P1 conforme impacto do fluxo real**.

---

# 13. Notificações

Foram identificadas estruturas/integrações de WhatsApp, e-mail, push e eventos internos, mas o encadeamento evento → fila → provider → callback → deduplicação → estado final ainda não está validado para todos os eventos de pedido.

Status: 🟠 INCOMPLETO.

---

# 14. Relatórios

Existem RPCs de resumo de negócio, série de receita e relatórios de entrega. Nenhum KPI será classificado como correto até rastrear interface → RPC → tabelas → filtros temporais/timezone → fórmula.

Status: ❓ NÃO FOI POSSÍVEL VALIDAR ainda.

---

# 15. Configurações

**Fato observado:** `update_store_profile(...)` exige permissão `store.update_profile`, valida concorrência, nome, documento, telefone, WhatsApp, e-mail e timezone; grava `stores` e `store_settings`, registra auditoria e retorna configuração atualizada.

Configurações ainda precisam ser cruzadas com consumo real no storefront, checkout, delivery e automações.

Status: 🟡 FUNCIONAL COM RESSALVAS para persistência; integração de consumo ainda pendente.

---

# 16. Segurança

## 16.1 SECURITY DEFINER

O Supabase Advisor sinaliza diversas funções `SECURITY DEFINER` executáveis por `authenticated` e duas por `anon`.

**Não classificar automaticamente como vulnerabilidade.** A arquitetura atual usa RPCs `SECURITY DEFINER` como boundary de autorização e várias funções analisadas possuem guards internos corretos.

### Funções públicas anônimas conhecidas

- `storefront_delivery_quote(...)`
- `storefront_validate_fulfillment_v2(...)`

Ambas operam sobre uma loja pública ativa, validam localização/área quando necessário e são intencionalmente usadas pelo storefront. Permanecem na allowlist atual, mas serão revisadas contra abuso, enumeração, custos e limites.

## 16.2 RLS

Diversas tabelas em `public` têm RLS ligada e nenhuma policy direta, incluindo `orders`, `order_items`, `deliveries`, `customers` e estruturas financeiras/assinaturas. Isso é compatível com deny-by-default + RPC-only e **não deve ser alterado genericamente**.

## 16.3 Senhas vazadas

Supabase Advisor: proteção contra senhas vazadas está desativada.

Status: 🟠 INCOMPLETO / P1 de hardening de autenticação antes de escala ampla.

## 16.4 P0 obrigatório

Auditar sistematicamente toda função `SECURITY DEFINER` acessível a `authenticated` procurando uma destas falhas:

- `_store_id` aceito sem `has_permission/require_permission/ownership`;
- admin RPC sem permissão `platform.*`;
- courier RPC sem vínculo `current_courier_id/store_id`;
- billing RPC confiando em `_actor_user_id` passado pelo cliente sem comparar `auth.uid()`;
- lookup por `id` sem filtro de tenant;
- função que grava tenant/entity ID fornecido sem validação de ownership;
- função privilegiada em Edge com `verify_jwt=false` sem contrato de webhook/custom auth realmente necessário.

---

# 17. UX/UI

A shell tem navegação desktop, drawer mobile, bottom navigation mobile, estados de billing e logout. Pedidos tem loading/error/empty, feedback de realtime e bloqueio durante mutation.

Pendências operacionais:

- medir cliques de ações críticas;
- confirmar alerta de novo pedido em ambiente ruidoso;
- validar foco/teclado/touch target;
- prevenir ações destrutivas acidentais;
- testar dezenas de pedidos simultâneos;
- checar layout de detalhe/atribuição no celular pequeno.

---

# 18. Responsividade

**Fato observado:** shell possui navegação específica para mobile e safe-area inset. Isso não prova responsividade das páginas internas.

Breakpoints a validar via execução real:

- ~320–360 px
- ~390–430 px
- tablet
- notebook
- desktop largo

Status: ❓ NÃO FOI POSSÍVEL VALIDAR ainda.

---

# 19. Benchmark

Benchmark externo ainda em execução. Referências obrigatórias:

- iFood para Parceiros
- Anota AI
- Goomer
- Consumer
- Saipos
- Delivery Direto
- Neemo

Para cada achado registrar: referência, comportamento, problema resolvido, aderência à Comandiva, esforço, benefício e prioridade. Nenhuma feature será adicionada apenas por paridade competitiva.

---

# 20. Gaps

## Já identificados

1. Stripe Connect do lojista ainda sem prova E2E real.
2. Inventário completo de `SECURITY DEFINER` ainda não concluído.
3. Proteção contra senhas vazadas desativada.
4. Resíduos/Edge Functions de QA/bootstrap já foram registrados em auditoria de produção anterior e precisam de allowlist formal.
5. Contratos de banco no CI podem ser pulados se `SPARK_DATABASE_URL` não estiver configurado.
6. `/app/loja/devolucoes` não aparece na navegação principal; intenção ainda precisa ser comprovada.
7. Cliente ↔ lojista e lojista ↔ entregador ainda não têm prova E2E completa nesta auditoria.
8. KPIs/relatórios ainda sem rastreio de fórmula completo.

---

# 21. Bugs encontrados

Nenhum bug será registrado como confirmado apenas por suspeita. Achados confirmados serão adicionados com reprodução/evidência.

### Em investigação

- `LOJ-ROUTE-001`: rota de devoluções potencialmente órfã no menu.
- `LOJ-ORDER-001`: estado `pronto` aparece em regras de cancelamento, mas não foi encontrado como saída de `mark_ready`; mapear origem antes de decidir se é legado morto.

---

# 22. Dívidas técnicas

- Cobertura E2E do ciclo completo de pedido ainda precisa ser medida.
- Contratos de banco dependentes de secret de CI precisam ser enforcement obrigatório antes de escala.
- Edge Functions implantadas fora da main geram drift de produção.
- Auditoria de grants/guards de RPCs privilegiadas precisa virar teste automatizado, não revisão manual isolada.

---

# 23. Melhorias recomendadas

As recomendações serão consolidadas depois do inventário completo para evitar priorização prematura. Princípio atual: corrigir primeiro isolamento/autorização, integridade do pedido, pagamento, máquina de estados e integrações essenciais; depois UX/automação/diferenciais.

---

# 24. Plano de implementação

A ordem final depende dos achados, mas o plano inicial por dependência é:

## FASE A — P0 Segurança e integridade

- inventariar grants/RPCs privilegiadas;
- provar isolamento multi-tenant;
- revisar Edge Functions privileged/QA;
- fechar qualquer função sem guard interno;
- tornar contratos de segurança executáveis no CI.

## FASE B — Fluxo principal de pedidos

- checkout/criação idempotente;
- fila do lojista;
- transições e concorrência;
- histórico;
- cancelamento/rejeição;
- cliente tracking.

## FASE C — Cliente ↔ Lojista

- catálogo;
- disponibilidade/estoque;
- horários;
- entrega;
- pagamentos;
- atualização imediata/consistente no storefront.

## FASE D — Lojista ↔ Entregador

- criação de delivery;
- elegibilidade;
- atribuição;
- aceite/rejeição;
- retirada;
- rota;
- ocorrência/devolução;
- conclusão e sincronização do pedido.

## FASE E — Financeiro

- pagamento online;
- ledger/settlement;
- comissão/taxas;
- Connect;
- payout;
- refund/chargeback/reconciliação;
- assinatura SaaS.

## FASE F — Cardápio e configurações

- CRUD completo;
- variantes/opções;
- estoque;
- horários;
- endereço;
- bairros/radius;
- payment methods;
- identidade.

## FASE G — Dashboard e relatórios

- origem e fórmula de cada KPI;
- timezone;
- conciliação com pedidos/financeiro;
- estados vazios e filtros.

## FASE H — UX e responsividade

- mobile-first operacional;
- novo pedido/alerta;
- ações em pico;
- acessibilidade;
- rede ruim e recuperação.

## FASE I — Automações

- WhatsApp;
- e-mail;
- push;
- regras de automação;
- deduplicação/idempotência;
- observabilidade.

## FASE J — Diferenciais competitivos

Somente após benchmark + impacto/ROI + compatibilidade com arquitetura.

---

# 25. Testes necessários

## Qualidade estática

- `bun run test:hygiene`
- `bun run test:db-static`
- `bun run lint:ci`
- `bun run typecheck`
- `bun run build`
- `bun run test:smoke`
- `bun run check`

## Banco / segurança

- isolamento entre duas lojas reais de teste;
- usuário sem role tentando RPC de outra loja;
- atendente/cozinha tentando ação de gerente;
- lojista tentando RPC `platform.*`;
- courier tentando delivery de outro courier/loja;
- troca manual de `_store_id`, `_order_id`, `_courier_id`;
- chamadas duplicadas com mesma idempotency key;
- version conflict em duas sessões.

## Pedido E2E mínimo

1. storefront carrega loja ativa;
2. cliente monta carrinho real;
3. preço é recalculado no servidor;
4. checkout valida fulfillment/config version;
5. pedido é criado uma única vez;
6. lojista recebe pedido;
7. aceita;
8. inicia preparo;
9. marca pronto;
10. delivery é criado/atribuído se entrega;
11. entregador executa ciclo;
12. cliente acompanha cada mudança;
13. pagamento/settlement ficam coerentes;
14. relatório reflete o pedido concluído;
15. refresh/reconnect preserva estado.

---

# 26. Decisões arquiteturais

## ADR-LOJ-001 — Não abrir policies diretas apenas para silenciar Advisor

**Decisão:** preservar deny-by-default nas tabelas RPC-only até que exista caso de acesso direto explicitamente necessário.

**Motivo:** RLS sem policy bloqueia acesso direto; adicionar policy genérica pode criar BOLA/IDOR. A autorização do domínio está concentrada em RPCs com guards internos.

## ADR-LOJ-002 — Não remover `SECURITY DEFINER` em massa

**Decisão:** auditar função por função. Só alterar quando houver ausência de guard, grant excessivo ou possibilidade de executar ação fora do tenant/role.

**Motivo:** várias RPCs dependem de `SECURITY DEFINER` para operar sobre tabelas deny-by-default e implementam autorização própria.

## ADR-LOJ-003 — Alterações funcionais em branch isolada

**Decisão:** executar esta auditoria/implementação em `audit/lojista-360-2026-08-22` e não diretamente na `main` até os gates relevantes passarem.

---

# 27. Pendências

- [ ] concluir inventário de rotas e páginas;
- [ ] concluir inventário de RPCs/tabelas por funcionalidade;
- [ ] concluir auditoria de guards de todas as RPCs `SECURITY DEFINER` acessíveis;
- [ ] mapear enum completo e todos os produtores/consumidores de status de pedido;
- [ ] mapear enum completo e transições de delivery;
- [ ] auditar checkout e criação de pedido;
- [ ] auditar tracking público;
- [ ] auditar catálogo → storefront;
- [ ] auditar horários/abertura/fechamento;
- [ ] auditar entrega/bairros/radius/routing;
- [ ] auditar pagamentos/Stripe/settlement/payout/refunds;
- [ ] auditar WhatsApp/e-mail/push;
- [ ] auditar dashboard/KPIs/relatórios;
- [ ] auditar configurações e seu consumo real;
- [ ] auditar RBAC de equipe;
- [ ] auditar UX/responsividade em runtime;
- [ ] executar benchmark competitivo;
- [ ] executar gap analysis;
- [ ] implementar P0/P1 confirmados;
- [ ] rodar gates e registrar evidências;

---

# Matriz obrigatória de auditoria

| ID | Área | Funcionalidade | Frontend | Backend | Banco | Cliente | Entregador | Admin | Status | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|
| LOJ-AUTH-001 | Segurança | Proteção da shell do lojista | `src/routes/app/loja.tsx` | guards/auth context | roles/auth | N/A | N/A | indireto | 🟡 | P1 |
| LOJ-SEC-001 | Segurança | Isolamento por `store_id` em RPCs principais | vários | RPC + `private.has_permission` | `user_roles` | N/A | parcial | parcial | 🟡 | P0 |
| LOJ-SEC-002 | Segurança | Inventário completo SECURITY DEFINER | N/A | RPCs | pg_proc/grants | sim | sim | sim | 🟠 | P0 |
| LOJ-SEC-003 | Auth | Proteção contra senha vazada | Auth UI | Supabase Auth | Auth | N/A | N/A | N/A | 🟠 | P1 |
| LOJ-ORDER-001 | Pedidos | Listagem/fila | `pedidos.tsx` | `list_my_store_orders` | `orders` | indireto | indireto | indireto | 🟡 | P1 |
| LOJ-ORDER-002 | Pedidos | Contadores | `pedidos.tsx` | `get_my_store_order_counts` | `orders` | N/A | N/A | N/A | 🟡 | P2 |
| LOJ-ORDER-003 | Pedidos | Aceitar/recusar/preparar/pronto/cancelar | `pedidos.tsx` | transition RPCs | orders/history/audit | precisa propagar | cria delivery | audita | 🟡 | P1 |
| LOJ-ORDER-004 | Pedidos | Concorrência por versão | actions UI | `private.transition_store_order` | `orders.version` | N/A | N/A | N/A | 🟡 | P1 |
| LOJ-DEL-001 | Entrega | Criar delivery ao ficar pronto | pedidos | `ensure_delivery_for_order` | deliveries | tracking pendente | recebe depois | audita | 🟡 | P1 |
| LOJ-DEL-002 | Entrega | Atribuir entregador | pedidos | `set_delivery_courier` | deliveries/events | pendente | sim | audita | 🟡 | P1 |
| LOJ-CAT-001 | Cardápio | Editar produto simples | produtos | `update_simple_product` | products | não provado | N/A | auditável | 🟠 | P1 |
| LOJ-CFG-001 | Config | Dados do estabelecimento | config | `update_store_profile` | stores/settings | consumo não provado | indireto | auditável | 🟡 | P1 |
| LOJ-FIN-001 | Financeiro | Pagamento do pedido | checkout/loja | Stripe/RPCs | orders/private Stripe | sim | N/A | sim | 🟠 | P0 |
| LOJ-FIN-002 | Financeiro | Settlement/payout | plano/financeiro | payout RPC/worker | private settlement/payout | N/A | N/A | sim | 🟠 | P0 |
| LOJ-NOTIF-001 | Notificações | Evento de status do pedido | pedidos | event emitters/workers | events/queues | pendente | pendente | observável | 🟠 | P1 |
| LOJ-ROUTE-001 | Rotas | Acesso a devoluções | `/app/loja/devolucoes` | a mapear | a mapear | N/A | sim | indireto | 🟠 | P2 |
| LOJ-REPORT-001 | Relatórios | KPIs/entregas | relatórios | report RPCs | orders/deliveries | N/A | N/A | indireto | ❓ | P2 |
| LOJ-WA-001 | WhatsApp | Dashboard/automação | `/app/loja/whatsapp` | provider/workers | filas/readiness | sim | talvez | observável | 🟠 | P1 |
| LOJ-SMART-001 | Smart Delivery | Routing/readiness | smart delivery | routing worker/RPCs | delivery jobs/cache | sim | sim | observável | 🟠 | P1 |
| LOJ-PLAN-001 | Billing | Plano e assinatura | `/app/loja/plano` | billing RPC/Stripe | subscriptions | N/A | N/A | sim | 🟠 | P1 |

## Campos detalhados por item

Cada item, ao ser aprofundado, deve registrar também:

- arquivos relacionados;
- problema;
- causa provável/confirmada;
- comportamento esperado;
- comportamento atual;
- solução proposta;
- risco;
- dependências;
- teste necessário;
- evidência executada;
- status da implementação;
- commit/migration quando aplicável.

---

# Log de execução

## 2026-08-22 — abertura

- Repositório e branch `main` confirmados.
- Supabase `pediu-aqui` confirmado como ambiente alvo.
- Stack e scripts de qualidade identificados.
- Rotas do lojista e principais rotas transversais inventariadas.
- Shell do lojista inspecionada.
- Painel de pedidos e `src/store-orders/api.ts` inspecionados parcialmente.
- Implementação de `private.transition_store_order`, `private.set_delivery_courier`, `private.has_permission`, `private.require_permission`, `private.resolve_store`, `update_store_profile`, `update_simple_product`, `request_my_store_payout`, `admin_suspend_store`, `admin_reactivate_store`, `storefront_delivery_quote` e `storefront_validate_fulfillment_v2` inspecionada no banco ativo.
- Supabase Security Advisor executado.
- Nenhum P0 foi declarado apenas pelo warning de `SECURITY DEFINER`; guards internos foram encontrados nas amostras críticas.
- Próxima frente: inventário sistemático de funções privilegiadas + máquina completa pedido/entrega + checkout/storefront antes de qualquer mudança estrutural.
