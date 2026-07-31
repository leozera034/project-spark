# Auditoria de Escopo da Fase 06 — Correções aplicadas na Fase 07

A Fase 06 deveria entregar **apenas isolamento entre lojas**. Ela antecipou acessos
que pertencem a fases posteriores. Este documento registra o que foi removido, por
quê e para qual fase o assunto voltou.

## 1. Cardápio público antecipado (pertence à Fase 11)

**Removido:** todas as policies de `anon` sobre `stores`, `store_settings`,
`store_hours`, `neighborhoods`, `payment_methods`, `categories`, `products`,
`product_variants`, `option_groups`, `option_items`, `product_option_groups`,
`combos`, `combo_items` e `promotions`, além do `GRANT SELECT` por coluna em
`stores` e dos grants de leitura para `anon` nas demais tabelas de catálogo.

**Motivo:** a experiência pública do cliente final é da Fase 11. Abrir leitura
anônima antes de existir tela é exposição sem contrapartida.

**Estado atual:** `anon` não possui nenhuma policy nem nenhum `GRANT` em `public`.

## 2. Dados operacionais do entregador antecipados (Fases 21 e 22)

**Removido:** policies que davam ao entregador leitura de `deliveries` sem dono,
leitura de `orders` e `order_items` vinculados a essas entregas, escrita em
`deliveries` e escrita em `delivery_events`.

**Motivo:** o fluxo de oferta, aceite atômico (D-030) e ocorrências é da Fase 22.

**Estado atual:** o entregador enxerga somente a própria linha em `couriers`, o
mínimo para o aplicativo reconhecer a sessão.

## 3. Acesso global da administração antecipado (Fases 24 e 25)

**Removido:** policies de `admin_plataforma` sobre `plans`, `stores`,
`store_subscriptions`, `subscription_payments` e `audit_logs`.

**Motivo:** planos, assinaturas, cobrança e auditoria são das Fases 24 e 25.

**Estado atual:** nenhuma leitura administrativa global está aberta. A regra de que
a plataforma nunca lê cliente, endereço, pedido, item de pedido ou entrega passa a
ser estrutural: essas permissões não existem na matriz.

## 4. Escrita ampla de gestão antecipada (D-036 revogada)

**Removido:** todas as policies `INSERT`, `UPDATE` e `DELETE` concedidas a
proprietário e gerente com base apenas em pertencer à loja
(`private.is_store_manager`), sobre catálogo, cadastro, clientes, pedidos e entregas.

**Motivo:** pertencer à loja não é autorização. Cada escrita deve ser liberada pela
fase dona do assunto, verificando a ação específica.

**Estado atual:** nenhuma escrita está aberta na Data API para `authenticated`.

## 5. Grants revistos

`REVOKE ALL ... FROM anon, authenticated` em todas as tabelas de `public`, seguido
de `GRANT SELECT` apenas onde existe policy correspondente: perfil próprio, papéis
próprios, dados institucionais da própria loja, catálogo interno da própria loja e
próprio cadastro de entregador. `service_role` mantém acesso completo para uso
interno de servidor.

## 6. Efeito no linter

Após a limpeza, tabelas sem nenhuma policy passam a aparecer como
"RLS habilitada sem policy" no nível informativo. **Esse é o estado desejado**: a
tabela está fechada e permanecerá assim até a fase dona abrir o acesso necessário.

Também permanecem três avisos sobre funções `SECURITY DEFINER` executáveis por
usuário autenticado: `get_my_auth_context`, `complete_my_initial_password_change` e
`get_my_authorization_context`. As três operam exclusivamente sobre `auth.uid()`,
não aceitam identidade por parâmetro e não devolvem dado de terceiros.

## 7. O que foi preservado

- Isolamento estrutural por `store_id` e chaves estrangeiras compostas (D-024).
- Funções de contexto no schema `private`, fora da API (D-031).
- Negação por padrão como regra geral (D-026, D-032).
- Autenticação, sessão e troca de senha inicial da Fase 05, intactas.
