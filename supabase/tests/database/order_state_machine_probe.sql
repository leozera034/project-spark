\set ON_ERROR_STOP on
\echo '[probe] begin plain SQL state-machine diagnostics'

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

\echo '[probe] fixture created'
select store_id, actor_id, order_id from state_probe_context;

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

\echo '[probe] has_permission orders.accept'
select private.has_permission(
  'orders.accept'::public.app_permission,
  (select store_id from state_probe_context)
);

\echo '[probe] order_allowed_actions for accepted pickup'
select private.order_allowed_actions(
  'aceito'::public.order_status,
  'retirada'::public.fulfillment_type,
  (select store_id from state_probe_context)
);

reset role;

\echo '[probe] orders UPDATE + triggers'
savepoint probe_order_update;
update public.orders
   set updated_at = updated_at
 where id = (select order_id from state_probe_context);
rollback to savepoint probe_order_update;
release savepoint probe_order_update;

\echo '[probe] order_status_history INSERT'
savepoint probe_history;
insert into public.order_status_history (
  store_id,
  order_id,
  from_status,
  to_status,
  actor_kind,
  actor_user_id,
  action
)
select
  store_id,
  order_id,
  'aguardando_confirmacao'::public.order_status,
  'aceito'::public.order_status,
  'loja',
  actor_id,
  'probe_accept'
from state_probe_context;
rollback to savepoint probe_history;
release savepoint probe_history;

\echo '[probe] audit_logs INSERT'
savepoint probe_audit;
insert into public.audit_logs (
  store_id,
  actor_user_id,
  actor_kind,
  action,
  entity,
  entity_id,
  context
)
select
  store_id,
  actor_id,
  'loja',
  'probe.order.accepted',
  'orders',
  order_id,
  jsonb_build_object('fromStatus', 'aguardando_confirmacao', 'toStatus', 'aceito', 'version', 2)
from state_probe_context;
rollback to savepoint probe_audit;
release savepoint probe_audit;

\echo '[probe] emit_store_event'
savepoint probe_realtime;
select private.emit_store_event(
  (select store_id from state_probe_context),
  'order',
  (select order_id from state_probe_context),
  'probe.order.status_changed',
  2
);
rollback to savepoint probe_realtime;
release savepoint probe_realtime;

set local role authenticated;

\echo '[probe] full transition_store_order accept'
select private.transition_store_order(
  (select store_id from state_probe_context),
  (select order_id from state_probe_context),
  'accept',
  1
);

\echo '[probe] full transition completed without backend crash'
rollback;
