# Matriz de Políticas RLS — Pediu Aqui (Fase 06)

> Escopo desta fase: **isolamento por loja**. A matriz fina de permissões por cargo
> (quem pode aceitar pedido, quem edita cardápio, quem cancela) é da **Fase 07**.

## 1. Princípios

1. **Negação por padrão.** Nenhuma tabela tem policy `USING (true)`.
2. **Isolamento estrutural.** Toda policy de tabela operacional compara `store_id` com as
   lojas do usuário. Não existe caminho de consulta entre lojas.
3. **O cliente nunca declara a loja.** O vínculo vem sempre de `user_roles` ou de
   `courier_auth_identities`, lidos no banco.
4. **Grants acompanham policies.** Um papel só recebe `GRANT` para a operação que alguma
   policy realmente permite.
5. **Sem recursão.** As funções de contexto são `SECURITY DEFINER` e vivem no schema
   `private`, fora da API. Elas leem `user_roles` sem disparar as policies que as usam.

## 2. Schema `private` (não exposto na Data API)

| Função | Retorno | Uso |
| --- | --- | --- |
| `private.current_user_id()` | `uuid` | identidade da sessão |
| `private.is_platform_admin()` | `boolean` | administração da plataforma |
| `private.is_store_member(store_id)` | `boolean` | proprietário, gerente, atendente, cozinha |
| `private.is_store_manager(store_id)` | `boolean` | proprietário e gerente (escrita da Fase 06) |
| `private.current_courier_id()` | `uuid` | entregador ativo, login habilitado, sem troca pendente |
| `private.current_courier_store_id()` | `uuid` | loja do entregador |
| `private.is_public_store(store_id)` | `boolean` | loja com status `ativa` |

`REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE` apenas para `anon`, `authenticated` e
`service_role`. O schema `private` não está nos schemas expostos, então nenhuma dessas
funções é chamável como RPC.

## 3. Matriz por audiência

| Audiência | Enxerga | Escreve |
| --- | --- | --- |
| Visitante (`anon`) | lojas ativas (colunas públicas), configurações, horários, bairros, formas de pagamento, categorias, produtos, variações, opções, combos e promoções vigentes | nada |
| Atendente / Cozinha | tudo da própria loja | nada nesta fase |
| Proprietário / Gerente | tudo da própria loja | catálogo, cadastro, clientes, pedidos, entregas da própria loja |
| Entregador | próprio cadastro; entregas da própria loja sem dono ou dele; pedidos e itens dessas entregas | assume entrega própria; registra ocorrências das próprias entregas |
| Administração da plataforma | lojas, planos, assinaturas, cobranças, auditoria | dados institucionais da loja |
| `service_role` | tudo (uso interno de servidor) | tudo |

## 4. Fechamentos explícitos

- `anon` **não** enxerga `customers`, `customer_addresses`, `orders`, `order_items`,
  `order_item_options`, `order_status_history`, `deliveries`, `delivery_events`,
  `couriers`, `courier_auth_identities`, `audit_logs`, assinaturas nem cobranças.
- `anon` **não** enxerga `stores.document`, `stores.legal_name` nem `stores.email`:
  o `GRANT SELECT` para `anon` é por coluna. Consultas públicas precisam listar colunas
  explicitamente; `select *` como visitante falha por privilégio — é intencional.
- A administração da plataforma **não** enxerga cliente, endereço, pedido nem item de
  pedido de nenhuma loja.
- `audit_logs`, `order_status_history`, `store_subscriptions` e `subscription_payments`
  são **somente leitura** pela API. Escrita apenas por `service_role`.
- `courier_auth_identities` nunca é escrita pelo aplicativo. A redefinição continua na
  função de servidor com autorização no banco.
- `public.courier_delivery_counts` usa `security_invoker = true`: a view respeita o RLS
  de quem consulta, nunca o do dono.

## 5. Acompanhamento público de pedido

O acompanhamento por `public_tracking_token` **não** foi liberado via RLS. Uma policy não
consegue exigir posse do token, e liberar `orders` para `anon` significaria expor todos os
pedidos da loja. O acesso será feito por função de servidor que valida o token e devolve
apenas os campos de acompanhamento.

## 6. Aviso do linter aceito

O linter marca `public.get_my_auth_context()` e
`public.complete_my_initial_password_change()` como `SECURITY DEFINER` executáveis por
usuário autenticado. É intencional: ambas operam exclusivamente sobre `auth.uid()`, não
aceitam identidade por parâmetro e não devolvem dado de terceiros.
`public.authorize_courier_reset()` recebe um parâmetro de ator e por isso tem `EXECUTE`
apenas para `service_role`.

## 7. Plano de teste de isolamento

Com dois usuários, cada um vinculado a uma loja diferente:

1. `select` em cada tabela operacional retorna somente linhas da própria loja.
2. `insert` com `store_id` da outra loja é rejeitado pelo `WITH CHECK`.
3. `update` de linha da outra loja afeta zero linhas.
4. `delete` de linha da outra loja afeta zero linhas.
5. Entregador da loja A não enxerga entrega, pedido nem item da loja B.
6. Entregador não consegue atribuir entrega a outro entregador (`WITH CHECK` exige
   `courier_id = private.current_courier_id()`).
7. Visitante anônimo não lê cliente, pedido, entrega nem documento da loja.
8. Administração da plataforma não lê cliente nem pedido de nenhuma loja.
