# Auditoria de Produção — Comandiva

Data: 2026-08-21

Este documento registra o estado verificado da produção após a auditoria geral de segurança, integrações, banco, jobs, CI e operação. Ele substitui como referência operacional o diagnóstico de 2026-08-18 que ainda tratava o cutover para o Supabase externo como bloqueado.

## Classificação

**Aprovada com ressalvas para piloto controlado.**

A base principal está operacional e foi endurecida durante esta auditoria, mas ainda não recomendo escala comercial ampla antes de fechar os itens críticos remanescentes: Stripe Connect real de lojista, provisionamento real de WhatsApp, enforcement dos contratos de banco no CI, retirada das funções temporárias privilegiadas e proteção contra senhas vazadas no Supabase Auth.

## Ambiente verificado

- Repositório: `leozera034/project-spark`
- Branch operacional: `main`
- Supabase externo de produção: `ypgteuxzgqmkkkpvibhi`
- Região: `sa-east-1`
- Estado do projeto Supabase: `ACTIVE_HEALTHY`
- Estado observado no banco durante a auditoria:
  - 3 usuários de Auth
  - 2 lojas
  - 5 pedidos
  - 11 produtos
  - 5 clientes
  - 2 buckets de Storage
  - 1 tabela publicada no Realtime

## Readiness das integrações

### Stripe — infraestrutura da plataforma

Estado verificado:

- secret key configurada
- publishable key configurada
- webhook secret configurada
- Stripe Connect habilitado
- provider conectado
- último health check HTTP 200
- nenhum erro de health registrado

**Ressalva crítica:** `private.stripe_connect_accounts` estava com zero contas. Há tentativas de bootstrap, mas ainda não existe evidência de uma conta real de lojista conectada e validada de ponta a ponta. Portanto, repasses via Connect não devem ser tratados como produção plenamente homologada.

### E-mail — Resend

Estado verificado:

- API key configurada
- domínio de envio configurado
- domínio verificado
- webhook secret configurada
- entrega de webhook verificada
- sem erro atual

Classificação: **operacional, com worker endurecido nesta auditoria.**

### Mapas / Smart Delivery

Google Maps permanece fail-closed/não homologado em produção.

OpenRouteService está configurado com:

- API key ativa
- routes habilitado
- geocoding habilitado
- kill switch desativado
- sem erro atual

Classificação: **base de routing ativa via OpenRouteService; Smart Delivery deve permanecer em teste até QA funcional completo.**

### WhatsApp

A arquitetura existe: onboarding, templates, provider adapters, webhook e worker. Porém não havia sessão/provisionamento real de loja registrado nas tabelas de onboarding/provisioning durante esta auditoria.

Classificação: **em homologação.**

### Push

Nenhum runtime readiness de produção foi comprovado.

Classificação: **não confirmado / não anunciar como disponível.**

## Correções aplicadas nesta auditoria

### 1. Proteção contra chave privilegiada no navegador

Arquivo: `src/integrations/supabase/client.ts`

Antes, a configuração do cliente aceitava chaves `sb_secret_...` como runtime válida. Uma configuração incorreta de ambiente poderia colocar uma chave privilegiada no bundle do navegador.

Agora:

- `sb_secret_...` é rejeitada explicitamente
- somente publishable key ou anon JWT legado são aceitos no cliente
- URL de projeto inesperada é ignorada
- há fallback para a configuração pública conhecida do projeto correto

### 2. Timeout nas chamadas server → Edge

Arquivo: `src/integrations/supabase/client.server.ts`

Foi adicionado timeout de 15 segundos com `AbortController` e normalização de falhas:

- timeout → `backend_timeout` / 504
- falha de rede → `backend_unavailable` / 503

Isso evita requests presos indefinidamente e melhora comportamento de falha.

### 3. Repository hygiene reforçado

Arquivo: `tools/check-repository-hygiene.mjs`

Além de procurar material secreto concreto, o teste agora bloqueia nomes de env privilegiados em `VITE_*`, incluindo service role e private-key-style envs. Isso reduz o risco de futura exposição de segredo no bundle.

### 4. CI reprodutível

Arquivo: `.github/workflows/quality-gate.yml`

O workflow usava `npm install` apesar do repositório usar `bun.lock`. Foi alterado para:

`bun install --frozen-lockfile --ignore-scripts`

Isso reduz drift de dependências entre máquina local e CI.

### 5. RPCs administrativas recentes fechadas para anônimo

Migration de produção e Git:

`20260821193711_harden_recent_admin_rpc_execute_grants`

Foi removido `EXECUTE` de `PUBLIC/anon` e mantido somente `authenticated/service_role` para as RPCs administrativas recentes de serviços profissionais e demanda de perfis.

### 6. RPCs operacionais fechadas para anônimo

Migration:

`20260821194059_restrict_authenticated_operational_rpcs`

Foram fechadas para `anon` 17 RPCs de operação autenticada, incluindo configuração de entrega, templates de catálogo, relatórios operacionais, devolução de entregas e serviços profissionais.

Após a correção, apenas duas funções `SECURITY DEFINER` permanecem executáveis pelo papel anônimo, ambas intencionalmente públicas para o storefront:

- `storefront_delivery_quote(...)`
- `storefront_validate_fulfillment_v2(...)`

### 7. Security contract atualizado

Arquivo: `supabase/tests/security_contract.sql`

O contrato antigo exigia zero funções `SECURITY DEFINER` públicas, mas isso não refletia a arquitetura atual do storefront.

Agora há allowlist explícita para as duas RPCs públicas esperadas e o teste falha se qualquer outra `SECURITY DEFINER` voltar a ficar acessível por `anon`.

### 8. RLS otimizado sem mudar permissão

Migration:

`20260821194140_optimize_auth_rls_initplans`

Quatro policies foram ajustadas de `auth.uid()` por linha para `(select auth.uid())`, mantendo a mesma regra de acesso e permitindo init-plan por statement.

Os respectivos alertas do advisor desapareceram após a migration.

### 9. Índices comprovadamente duplicados removidos

Migration:

`20260821194658_drop_proven_duplicate_indexes`

Foram removidas apenas duplicatas exatas, preservando o índice respaldado por constraint ou a versão mais atual:

- `private.financial_journals_event_key_uidx`
- `public.user_roles_store_unique_idx`

Não foram removidos índices apenas por estarem marcados como "unused", pois o volume atual é baixo e a amostra de uso ainda não é suficiente para essa decisão.

### 10. Workers ociosos e recuperação de leases

#### WhatsApp

Migration:

`20260821193724_gate_whatsapp_worker_cron_on_pending_work`

O cron continua avaliando a cada minuto, mas a Edge Function só é chamada se houver job devido ou job `processing` stale que precise de recuperação.

#### E-mail

Migration:

`20260821194836_recover_email_worker_leases_and_gate_cron`

Foi corrigido um risco de e-mail preso indefinidamente em `sending` após crash do worker. Locks com mais de 10 minutos agora são recuperados com política de retry/cancelamento, e o Edge worker só acorda quando há trabalho real.

#### Stripe payout

Migration:

`20260821194853_recover_payout_worker_leases_and_gate_cron`

Pedidos de repasse presos em `processing` por mais de 10 minutos voltam para estado recuperável. O Edge worker só é chamado quando há payout devido ou lease stale.

#### Smart Delivery

Migration:

`20260821194937_gate_smart_delivery_worker_on_pending_work`

A reconciliação continua ocorrendo a cada minuto no banco, mas a Edge Function só é chamada quando há job criado, job devido ou lease expirado. Mantém self-healing sem gastar invocações vazias.

Os logs pós-migration mostraram cessação das invocações ociosas correspondentes quando as filas estavam vazias.

## Fragilidades ainda abertas

### CRÍTICO — Stripe Connect de lojista ainda não provado E2E

A infraestrutura Stripe está saudável, mas não há conta Connect de loja validada no banco. Antes de vender repasse automático como pronto, executar um ciclo real e controlado:

1. onboarding Connect
2. capabilities/payments/payouts
3. pedido pago
4. settlement
5. criação do payout request
6. transferência idempotente
7. webhook/reconciliação
8. falha e retry

### ALTO — função temporária privilegiada `comandiva-connect-bootstrap`

Existe no ambiente uma Edge Function de bootstrap Connect que:

- não está versionada na `main`
- usa `verify_jwt=false`
- é protegida por custom secret
- pode criar contas Stripe e gravar estado no banco

Ela é uma superfície privilegiada de implantação. Não foi desativada nesta auditoria porque o fluxo Connect ainda não está comprovado e pode depender dela. A recomendação é substituí-la por fluxo versionado e autenticado e então aposentá-la.

### ALTO — resíduos de QA/bootstrap no ambiente

Há Edge Functions one-shot/probe/QA ainda implantadas, incluindo funções de foundation, billing QA e bootstrap. Algumas estão inertes, mas aumentam drift entre Git e produção.

Criar inventário de funções permitidas e remover do ambiente tudo que não fizer parte da allowlist de produção.

### ALTO — contratos de banco no CI podem estar sendo pulados

O job `database-contracts` depende de `SPARK_DATABASE_URL`. O workflow hoje explica o skip se o secret não existir.

Não houve status de CI verificável para os commits recentes via integração do GitHub. Além disso, o security contract estava desatualizado antes desta auditoria, o que sugere que esses contratos podem não estar sendo executados em toda mudança.

Ação necessária:

- configurar `SPARK_DATABASE_URL` no GitHub Actions
- em `main`, transformar ausência do secret em falha, não skip
- exigir Quality Gate antes de aceitar mudança de banco

### ALTO — proteção contra senha vazada desativada

O Supabase Advisor indica que a proteção contra senhas vazadas está desabilitada no Auth.

Ação: habilitar leaked-password protection nas configurações do Supabase Auth antes de escala ampla.

### MÉDIO — WhatsApp ainda sem provisionamento real

A infraestrutura existe, mas falta evidência de uma loja real provisionada e envio/recebimento homologado.

### MÉDIO — Push ainda não homologado

Não há readiness de produção comprovado.

### MÉDIO — performance futura / foreign keys sem índice

O advisor aponta várias foreign keys sem índice. Não foi criada uma bateria de índices automaticamente porque isso aumenta custo de escrita e armazenamento e o tráfego atual ainda é pequeno.

Próxima etapa correta:

- capturar queries lentas/mais frequentes
- priorizar FKs usadas em joins/delete/update reais
- adicionar índices com evidência

### BAIXO/MÉDIO — três grupos de policies permissivas duplicadas

O advisor ainda aponta múltiplas policies permissivas em:

- `category_profiles`
- `store_automation_rules`
- `store_marketing_campaigns`

Não foram consolidadas nesta rodada porque misturam leitura e capacidade de manager/write. Fazer isso apenas com testes de regressão específicos.

## O que não foi feito de propósito

- não foram apagados índices apenas porque o advisor diz "unused"
- não foram liberadas políticas RLS para silenciar warnings
- não foram removidas em massa Edge Functions temporárias sem confirmar dependências
- não foram alteradas taxas, preços, repasses ou regras comerciais
- não foi declarado build/CI aprovado sem check verificável
- não foi promovido WhatsApp, Push ou Stripe Connect de lojista a "produção pronta" sem prova E2E

## Critério para sair de piloto controlado

Considerar produção ampla apenas depois de:

- Quality Gate + database contracts obrigatórios e verdes
- Stripe Connect real E2E concluído
- funções temporárias privilegiadas removidas/aposentadas
- leaked-password protection habilitada
- WhatsApp mantido como homologação ou validado E2E antes de divulgação
- monitoramento de erros e filas sem jobs presos
- smoke de cadastro → cardápio → pedido → cozinha → entrega executado no domínio publicado

## Conclusão

A Comandiva está estruturalmente mais segura e mais barata de operar depois desta auditoria. As correções mais importantes foram feitas em ACL, isolamento de segredo, timeouts, leases de workers, chamadas ociosas, RLS, índices duplicados e contratos de segurança.

O maior risco restante não é mais uma falha óbvia de arquitetura; é **governança de produção e homologação de integrações críticas**. O próximo investimento deve ser fechar E2E e enforcement de CI antes de adicionar novos módulos.