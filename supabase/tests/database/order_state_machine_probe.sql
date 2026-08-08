\set ON_ERROR_STOP on
\echo '[probe] begin public order-transition surface probe'

-- This probe deliberately exercises only the RPC surface granted to the app.
-- Private helpers such as private.transition_store_order and
-- private.order_allowed_actions are revoked from authenticated and must not be
-- called directly by client-facing tests.
begin;
set local search_path = public, private, extensions, pg_temp;

create temp table state_probe_context (
  store_id uuid not null,
  actor_id uuid not null,
  order_id uuid
);

grant select on state_probe_context to authenticated;

insert into state_probe_context (store_id, actor_id)
select id, '33333333-3333-4333-8333-333333333333'::uuid
from public.stores
where slug = 'brasa-urbana';

insert into public.user_profiles (id, full_name, display_name, is_active)
select actor_id, 'State Probe Owner', 'Probe Owner', true
from state_probe_context
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, store_id, role, is_active)
select actor_id, store_id, 'proprietario'::public.app_role, true
from state_probe_context
on conflict do nothing;

with created as (
  insert into public.orders (
    store_id,
    order_number,
    customer_name,
    customer_phone,
    fulfillment,
    status,
    items_subtotal,
    delivery_fee,
    discount_total,
    total_amount,
    idempotency_key
  )
  select
    store_id,
    900001,
    'Probe Customer',
    '11999990301',
    'retirada'::public.fulfillment_type,
    'aguardando_confirmacao'::public.order_status,
    0,
    0,
    0,
    0,
    'state-probe-pickup-0001'
  from state_probe_context
  returning id
)
update state_probe_context c
   set order_id = created.id
  from created;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select actor_id::text from state_probe_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (select actor_id::text from state_probe_context),
    'role', 'authenticated'
  )::text,
  true
);

\echo '[probe] public.accept_store_order'
select public.accept_store_order(
  (select store_id from state_probe_context),
  (select order_id from state_probe_context),
  1,
  null
);

\echo '[probe] public surface completed successfully'
rollback;
