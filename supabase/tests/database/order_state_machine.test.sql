begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_temp;

select plan(23);

create temp table state_test_context (
  store_id uuid not null,
  actor_id uuid not null,
  payment_id uuid not null,
  area_id uuid not null,
  product_id uuid not null,
  pickup_order_id uuid,
  delivery_order_id uuid
);

grant select on state_test_context to authenticated;

insert into state_test_context (store_id, actor_id, payment_id, area_id, product_id)
select
  s.id,
  '22222222-2222-4222-8222-222222222222'::uuid,
  (select pm.id from public.payment_methods pm where pm.store_id = s.id and pm.kind = 'pix' and pm.is_active order by pm.sort_order, pm.id limit 1),
  (select n.id from public.neighborhoods n where n.store_id = s.id and n.name = 'Centro' and n.is_active and not n.is_archived limit 1),
  (select p.id from public.products p where p.store_id = s.id and p.name = 'Clássico da Casa' and not p.is_archived limit 1)
from public.stores s
where s.slug = 'brasa-urbana';

select ok(
  exists (select 1 from state_test_context where store_id is not null and payment_id is not null and area_id is not null and product_id is not null),
  'fixtures da Brasa para maquina de estados existem'
);

update public.store_settings
   set manual_override_open = true
 where store_id = (select store_id from state_test_context);

insert into public.user_profiles (id, full_name, display_name, is_active)
select actor_id, 'State Machine Owner', 'State Owner', true
from state_test_context
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, store_id, role, is_active)
select actor_id, store_id, 'proprietario'::public.app_role, true
from state_test_context
on conflict do nothing;

with created as (
  select public.storefront_submit_order(
    'brasa-urbana',
    jsonb_build_object(
      'idempotencyKey', 'state-pickup-0001',
      'customer', jsonb_build_object('firstName', 'Pickup', 'phone', '11999990201'),
      'fulfillment', jsonb_build_object('type', 'retirada', 'deliveryAreaId', null, 'configurationVersion', null),
      'address', null,
      'payment', jsonb_build_object('methodId', payment_id, 'changeFor', null),
      'notes', null,
      'lines', jsonb_build_array(jsonb_build_object(
        'lineId', 'pickup-line', 'product_id', product_id, 'variant_id', null,
        'quantity', 1, 'notes', null, 'selections', '[]'::jsonb
      ))
    )
  ) result
  from state_test_context
)
update state_test_context
   set pickup_order_id = nullif(created.result#>>'{order,id}', '')::uuid
  from created;

select ok((select pickup_order_id is not null from state_test_context), 'pedido de retirada criado');

with created as (
  select public.storefront_submit_order(
    'brasa-urbana',
    jsonb_build_object(
      'idempotencyKey', 'state-delivery-0001',
      'customer', jsonb_build_object('firstName', 'Delivery', 'phone', '11999990202'),
      'fulfillment', jsonb_build_object('type', 'entrega', 'deliveryAreaId', area_id, 'configurationVersion', null),
      'address', jsonb_build_object(
        'street', 'Rua Estado', 'number', '10', 'hasNoNumber', false,
        'complement', null, 'reference', null, 'label', 'Casa'
      ),
      'payment', jsonb_build_object('methodId', payment_id, 'changeFor', null),
      'notes', null,
      'lines', jsonb_build_array(jsonb_build_object(
        'lineId', 'delivery-line', 'product_id', product_id, 'variant_id', null,
        'quantity', 1, 'notes', null, 'selections', '[]'::jsonb
      ))
    )
  ) result
  from state_test_context
)
update state_test_context
   set delivery_order_id = nullif(created.result#>>'{order,id}', '')::uuid
  from created;

select ok((select delivery_order_id is not null from state_test_context), 'pedido de entrega criado');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from state_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select actor_id::text from state_test_context), 'role', 'authenticated')::text,
  true
);

select is(auth.uid(), (select actor_id from state_test_context), 'sessao operacional da loja resolvida');

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context),
    'accept', 1
  )->>'status',
  'aceito',
  'retirada pode ser aceita'
);

select is(
  (select version from public.orders where id = (select pickup_order_id from state_test_context)),
  2,
  'aceite incrementa version para 2'
);

select throws_ok(
  format(
    'select private.transition_store_order(%L::uuid,%L::uuid,''accept'',1)',
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context)
  ),
  'P0001', 'VERSION_CONFLICT',
  'versao antiga e rejeitada antes de nova mutacao'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context),
    'start_preparation', 2
  )->>'status',
  'em_preparo',
  'retirada entra em preparo'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context),
    'mark_ready', 3
  )->>'status',
  'aguardando_retirada',
  'retirada pronta vai para aguardando_retirada'
);

select is(
  (select count(*) from public.deliveries where order_id = (select pickup_order_id from state_test_context)),
  0::bigint,
  'retirada nunca cria delivery'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context),
    'complete_pickup', 4
  )->>'status',
  'retirado',
  'retirada e finalizada somente a partir de aguardando_retirada'
);

select throws_ok(
  format(
    'select private.transition_store_order(%L::uuid,%L::uuid,''complete_pickup'',5)',
    (select store_id from state_test_context),
    (select pickup_order_id from state_test_context)
  ),
  'P0001', 'INVALID_TRANSITION',
  'pedido retirado nao pode ser finalizado novamente'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select delivery_order_id from state_test_context),
    'accept', 1
  )->>'status',
  'aceito',
  'entrega pode ser aceita'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select delivery_order_id from state_test_context),
    'start_preparation', 2
  )->>'status',
  'em_preparo',
  'entrega entra em preparo'
);

select is(
  private.transition_store_order(
    (select store_id from state_test_context),
    (select delivery_order_id from state_test_context),
    'mark_ready', 3
  )->>'status',
  'aguardando_entregador',
  'entrega pronta vai para aguardando_entregador'
);

select is(
  (select count(*) from public.deliveries where order_id = (select delivery_order_id from state_test_context)),
  1::bigint,
  'entrega pronta cria exatamente uma delivery'
);

select is(
  (select status::text from public.deliveries where order_id = (select delivery_order_id from state_test_context)),
  'pendente',
  'delivery nasce pendente e sem responsavel'
);

select ok(
  (select courier_id is null from public.deliveries where order_id = (select delivery_order_id from state_test_context)),
  'delivery pendente nao atribui entregador automaticamente'
);

select ok(
  private.ensure_delivery_for_order(
    (select store_id from state_test_context),
    (select delivery_order_id from state_test_context)
  ) is not null,
  'ensure_delivery_for_order e idempotente e devolve a delivery existente'
);

select is(
  (select count(*) from public.deliveries where order_id = (select delivery_order_id from state_test_context)),
  1::bigint,
  'repetir ensure_delivery nao duplica delivery'
);

select throws_ok(
  format(
    'select private.transition_store_order(%L::uuid,%L::uuid,''mark_ready'',4)',
    (select store_id from state_test_context),
    (select delivery_order_id from state_test_context)
  ),
  'P0001', 'INVALID_TRANSITION',
  'pedido ja aguardando entregador nao aceita mark_ready novamente'
);

select is(
  (select count(*)
     from public.order_status_history
    where order_id = (select delivery_order_id from state_test_context)
      and action in ('accept','start_preparation','mark_ready')),
  3::bigint,
  'historico registra exatamente as tres transicoes operacionais da loja'
);

reset role;
select is(
  (select status::text from public.orders where id = (select delivery_order_id from state_test_context)),
  'aguardando_entregador',
  'falhas de transicao nao corrompem o estado final da entrega'
);

select * from finish();
rollback;
