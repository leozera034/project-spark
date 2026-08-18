# Auditoria do Supabase Externo — 2026-08-18

## Status executivo

**Cutover para `pediu-aqui` (`ypgteuxzgqmkkkpvibhi`): BLOQUEADO.**

O projeto externo possui a estrutura de banco clonada, mas ainda não contém o estado necessário para substituir o backend atual. Não alterar as variáveis de produção para esse projeto antes de cumprir o checklist de cutover abaixo.

## Evidências verificadas

### Supabase externo `pediu-aqui`

- `auth.users`: 0 usuários.
- Todas as 43 tabelas `public`: 0 linhas.
- Storage: 0 buckets.
- Realtime: nenhuma tabela na publication `supabase_realtime`.
- Edge Functions: nenhuma função implantada.
- As migrations de clone foram geradas diretamente no projeto externo e não existem integralmente no GitHub; portanto, ainda há drift entre o histórico remoto e `supabase/migrations`.

### Backend atual do Project Spark

A comparação com o banco conectado ao projeto Lovable confirmou estado real que ainda precisa ser migrado, incluindo:

- 41 usuários Auth confirmados;
- 33 lojas;
- catálogo, configurações e permissões por loja;
- pedidos, itens, clientes, entregas e histórico operacional;
- assinaturas e pagamentos registrados;
- buckets privados `product-images` e `store-branding`;
- Realtime em `public.store_order_realtime_events`.

## P0 de segurança encontrado e corrigido

O clone externo inicialmente deixou tabelas `public` com RLS desabilitado e privilégios amplos para `anon`/`authenticated`, além de várias funções `SECURITY DEFINER` executáveis por `anon`.

Correções aplicadas no projeto externo e versionadas no GitHub:

1. `20260818154825_restore_hardened_access_controls.sql`
   - habilita RLS nas tabelas públicas;
   - restaura policies do Spark endurecido;
   - reduz grants diretos;
   - remove execução anônima indevida de `SECURITY DEFINER`.

2. `20260818160442_harden_public_default_privileges.sql`
   - impede que novos objetos criados por migrations sob o owner `postgres` voltem a herdar acesso amplo de `anon`/`authenticated`.

3. `20260818160536_reharden_after_clone_completion.sql`
   - reaplica ACLs de funções após o clone ter criado rotinas adicionais depois do primeiro hardening.

O contrato SQL de segurança foi executado após a última migration e passou: nenhuma tabela `public` sem RLS e nenhuma `SECURITY DEFINER` inesperada executável por `anon`.

## Risco residual de permissões padrão

Os objetos atuais do Spark em `public` são owned by `postgres`, e os defaults desse owner foram endurecidos. Os defaults do papel gerenciado `supabase_admin` não puderam ser alterados pelo papel de migration conectado. Portanto:

- alterações de schema devem continuar exclusivamente por migrations versionadas;
- evitar criação manual de tabelas/funções pelo Dashboard;
- qualquer novo objeto em `public` deve declarar RLS/GRANTs/EXECUTE explicitamente e passar pelo gate de segurança.

## Drift de migrations

O histórico remoto contém migrations `clone_live_*` geradas durante a clonagem que não estão no repositório. O GitHub ainda não consegue reconstruir sozinho o estado completo do alvo externo.

Antes do cutover, criar e revisar um baseline reproduzível do schema atual ou incorporar o histórico de clone de forma controlada. Não tentar reaplicar cegamente migrations antigas sobre o schema clonado.

## Checklist obrigatório antes do cutover

- [ ] Definir o Supabase externo como alvo único de produção somente após migração completa.
- [ ] Obter backup/snapshot recuperável do backend atual antes de qualquer cópia.
- [ ] Migrar `auth` preservando UUIDs e hashes de senha.
- [ ] Migrar todas as tabelas de negócio em ordem compatível com FKs.
- [ ] Validar contagens, PKs, FKs e amostras semânticas por tenant.
- [ ] Migrar buckets, objetos e policies do Storage.
- [ ] Restaurar `public.store_order_realtime_events` na publication do Realtime.
- [ ] Replicar configurações de Auth, redirects, e-mail e demais settings necessários.
- [ ] Replicar secrets/configuração server-side sem versionar segredos.
- [ ] Executar contrato de RLS/RPC e invariantes de banco no alvo final.
- [ ] Testar login de loja, entregador e admin.
- [ ] Testar storefront público e criação/rastreamento de pedido.
- [ ] Testar catálogo, fila de pedidos, cozinha, entregas e permissões multi-tenant.
- [ ] Testar upload/leitura de imagens em Storage.
- [ ] Testar Realtime.
- [ ] Confirmar CI verde e smoke/E2E antes do switch.
- [ ] Fazer cutover das variáveis em uma única janela controlada.
- [ ] Manter rollback para o backend anterior durante a estabilização.
- [ ] Somente depois remover fallbacks/integrações do backend antigo.

## Regra de arquitetura

`GitHub/main` deve ser a fonte de verdade do código e das migrations. Mudanças manuais no banco que não sejam reproduzíveis pelo repositório não devem ser consideradas concluídas.
