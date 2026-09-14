begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_temp;

select plan(19);

-- ---------------------------------------------------------------------
-- Fixtures: identidade de loja A e um pedido real da loja B.
-- ---------------------------------------------------------------------
create temp table tenant_test_context (
  aurora_id uuid not null,
  brasa_id uuid not null,
  actor_id uuid not null,
  brasa_order_id uuid
);

grant select on tenant_test_context to authenticated;

insert into tenant_test_context (aurora_id, brasa_id, actor_id)
select
  (select id from public.stores where slug = 'mercado-aurora'),
  (select id from public.stores where slug = 'brasa-urbana'),
  '11111111-1111-4111-8111-111111111111'::uuid;

select ok(
  (select aurora_id is not null and brasa_id is not null from tenant_test_context),
  'as duas lojas deterministicas existem'
);

insert into public.user_profiles (id, full_name, display_name, is_active)
select actor_id, 'Tenant Test Aurora', 'Tenant Test', true
from tenant_test_context
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, store_id, role, is_active)
select actor_id, aurora_id, 'proprietario'::public.app_role, true
from tenant_test_context
on conflict do nothing;

-- Mantem a Brasa aberta apenas durante a transacao de teste.
update public.store_settings
   set manual_override_open = true
 where store_id = (select brasa_id from tenant_test_context);

-- Cria um pedido verdadeiro da loja B usando a mesma RPC publica do produto.
with fixture as (
  select
    s.id as store_id,
    (select pm.id
       from public.payment_methods pm
      where pm.store_id = s.id and pm.kind = 'pix' and pm.is_active
      order by pm.sort_order, pm.id limit 1) as payment_id,
    (select p.id
       from public.products p
      where p.store_id = s.id and p.name = 'Clássico da Casa' and not p.is_archived
      limit 1) as product_id
  from public.stores s
  where s.slug = 'brasa-urbana'
), submitted as (
  select public.storefront_submit_order(
    'brasa-urbana',
    jsonb_build_object(
      'idempotencyKey', 'tenant-isolation-brasa-order-0001',
      'customer', jsonb_build_object('firstName', 'Cliente B', 'phone', '11999990110'),
      'fulfillment', jsonb_build_object(
        'type', 'retirada',
        'deliveryAreaId', null,
        'configurationVersion', null
      ),
      'address', null,
      'payment', jsonb_build_object('methodId', payment_id, 'changeFor', null),
      'notes', null,
      'lines', jsonb_build_array(
        jsonb_build_object(
          'lineId', 'tenant-brasa-line',
          'product_id', product_id,
          'variant_id', null,
          'quantity', 1,
          'notes', null,
          'selections', '[]'::jsonb
        )
      )
    )
  ) as result
  from fixture
)
update tenant_test_context
   set brasa_order_id = nullif(submitted.result#>>'{order,id}', '')::uuid
  from submitted;

select ok(
  (select brasa_order_id is not null from tenant_test_context),
  'pedido real da loja B foi criado para o ataque cross-store'
);

-- ---------------------------------------------------------------------
-- Assume uma sessao autenticada vinculada SOMENTE a Mercado Aurora.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from tenant_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select actor_id::text from tenant_test_context),
    'role', 'authenticated'
  )::text,
  true
);

select is(
  auth.uid(),
  (select actor_id from tenant_test_context),
  'auth.uid resolve a identidade atacante da Aurora'
);

-- ---------------------------------------------------------------------
-- Camada 1: autorizacao central.
-- ---------------------------------------------------------------------
select ok(
  private.has_permission('store.view_basic', (select aurora_id from tenant_test_context)),
  'usuario possui store.view_basic na propria loja'
);
select ok(
  not private.has_permission('store.view_basic', (select brasa_id from tenant_test_context)),
  'usuario nao possui store.view_basic na outra loja'
);
select ok(
  private.has_permission('catalog.view', (select aurora_id from tenant_test_context)),
  'usuario possui catalog.view na propria loja'
);
select ok(
  not private.has_permission('catalog.view', (select brasa_id from tenant_test_context)),
  'usuario nao possui catalog.view na outra loja'
);
select ok(
  private.has_permission('orders.view_queue', (select aurora_id from tenant_test_context)),
  'usuario possui orders.view_queue na propria loja'
);
select ok(
  not private.has_permission('orders.view_queue', (select brasa_id from tenant_test_context)),
  'usuario nao possui orders.view_queue na outra loja'
);

-- ---------------------------------------------------------------------
-- Camada 2: RLS direto. Mesmo sabendo UUIDs da outra loja, nao ha linhas.
-- ---------------------------------------------------------------------
select ok(
  (select count(*) > 0
     from public.products
    where store_id = (select aurora_id from tenant_test_context)),
  'RLS permite produtos internos da propria loja'
);
select is(
  (select count(*)
     from public.products
    where store_id = (select brasa_id from tenant_test_context)),
  0::bigint,
  'RLS oculta produtos internos da outra loja'
);
select is(
  (select count(*)
     from public.user_roles
    where store_id = (select brasa_id from tenant_test_context)),
  0::bigint,
  'RLS nao revela papeis da outra loja'
);

-- ---------------------------------------------------------------------
-- Camada 3: RPCs SECURITY DEFINER precisam revalidar a loja recebida.
-- ---------------------------------------------------------------------
select ok(
  public.get_my_store_configuration((select aurora_id from tenant_test_context)) is not null,
  'RPC de configuracao aceita a propria loja'
);

select throws_ok(
  format(
    'select public.get_my_store_configuration(%L::uuid)',
    (select brasa_id from tenant_test_context)
  ),
  'P0001',
  'FORBIDDEN',
  'RPC de configuracao rejeita store_id da outra loja'
);

select ok(
  public.list_my_store_orders(
    (select aurora_id from tenant_test_context),
    null, null, null, false, null, null, 30, null, null
  ) is not null,
  'RPC de pedidos aceita a propria loja'
);

select throws_ok(
  format(
    'select public.list_my_store_orders(%L::uuid, null, null, null, false, null, null, 30, null, null)',
    (select brasa_id from tenant_test_context)
  ),
  'P0001',
  'FORBIDDEN',
  'RPC de pedidos rejeita leitura da outra loja'
);

select throws_ok(
  format(
    'select public.get_my_store_order_detail(%L::uuid, %L::uuid)',
    (select brasa_id from tenant_test_context),
    (select brasa_order_id from tenant_test_context)
  ),
  'P0001',
  'FORBIDDEN',
  'detalhe de pedido da outra loja e bloqueado antes de expor cliente/endereco'
);

-- Ataque de escrita: conhecendo store_id, order_id e version, ainda deve falhar.
select throws_ok(
  format(
    'select public.accept_store_order(%L::uuid, %L::uuid, 1, null)',
    (select brasa_id from tenant_test_context),
    (select brasa_order_id from tenant_test_context)
  ),
  'P0001',
  'FORBIDDEN',
  'usuario da loja A nao consegue aceitar pedido existente da loja B'
);

-- Confirma que o ataque nao mudou o objeto alvo.
reset role;
select is(
  (select status::text
     from public.orders
    where id = (select brasa_order_id from tenant_test_context)),
  'aguardando_confirmacao',
  'pedido da loja B permanece inalterado apos tentativa cross-store'
);

select * from finish();
rollback;
