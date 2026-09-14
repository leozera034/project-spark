begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_temp;

select plan(39);

create temp table courier_test_context (
  store_id uuid not null,
  courier_user_id uuid not null,
  owner_user_id uuid not null,
  courier_id uuid,
  order_id uuid,
  delivery_id uuid,
  occurrence_id uuid,
  acceptance_order_id uuid,
  acceptance_delivery_id uuid
);

grant select on courier_test_context to authenticated;

create temp table courier_action_results (
  label text primary key,
  result jsonb not null
);
grant select, insert on courier_action_results to authenticated;

insert into courier_test_context (store_id, courier_user_id, owner_user_id)
select
  id,
  '44444444-4444-4444-8444-444444444444'::uuid,
  '55555555-5555-4555-8555-555555555555'::uuid
from public.stores
where slug = 'brasa-urbana';

select ok(
  exists (select 1 from courier_test_context where store_id is not null),
  'Brasa Urbana existe para a prova operacional do entregador'
);

-- Auth rows exist only to satisfy the real courier_auth_identities FK. The test
-- still derives the active actor from request.jwt.claim.sub, just like PostgREST.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select courier_user_id, 'authenticated', 'authenticated', 'courier-audit@example.test', '', now(), now(), now()
from courier_test_context
on conflict (id) do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select owner_user_id, 'authenticated', 'authenticated', 'owner-audit@example.test', '', now(), now(), now()
from courier_test_context
on conflict (id) do nothing;

insert into public.user_profiles (id, full_name, display_name, is_active)
select courier_user_id, 'Courier Audit', 'Courier', true from courier_test_context
on conflict (id) do update set is_active = true;

insert into public.user_profiles (id, full_name, display_name, is_active)
select owner_user_id, 'Owner Audit', 'Owner', true from courier_test_context
on conflict (id) do update set is_active = true;

insert into public.user_roles (user_id, store_id, role, is_active)
select courier_user_id, store_id, 'entregador'::public.app_role, true from courier_test_context
on conflict do nothing;

insert into public.user_roles (user_id, store_id, role, is_active)
select owner_user_id, store_id, 'proprietario'::public.app_role, true from courier_test_context
on conflict do nothing;

with inserted as (
  insert into public.couriers (
    store_id, user_id, full_name, phone, status, is_online, can_accept_deliveries
  )
  select store_id, courier_user_id, 'Courier Audit', '11999990401',
         'ativo'::public.courier_status, false, true
  from courier_test_context
  returning id
)
update courier_test_context c set courier_id = inserted.id from inserted;

insert into public.courier_auth_identities (
  store_id, courier_id, auth_user_id, login_identifier, synthetic_email,
  requires_password_change, is_login_enabled, password_changed_at
)
select
  store_id,
  courier_id,
  courier_user_id,
  'courier.audit.01',
  '44444444444444448444444444444444@courier.pediuaqui.internal',
  false,
  true,
  now()
from courier_test_context;

-- Automatic acceptance mode: arrival is a milestone, not a status.
update public.stores
   set courier_acceptance_required = false
 where id = (select store_id from courier_test_context);

with inserted as (
  insert into public.orders (
    store_id, order_number, customer_name, customer_phone, fulfillment, status,
    address_snapshot, items_subtotal, delivery_fee, discount_total, total_amount,
    idempotency_key
  )
  select
    store_id, 910001, 'Cliente Operacional', '11999990402',
    'entrega'::public.fulfillment_type,
    'aguardando_entregador'::public.order_status,
    jsonb_build_object('street','Rua Operacional','number','10','neighborhood','Centro'),
    20, 5, 0, 25, 'courier-operations-order-0001'
  from courier_test_context
  returning id
)
update courier_test_context c set order_id = inserted.id from inserted;

with inserted as (
  insert into public.deliveries (
    store_id, order_id, courier_id, status, assigned_at
  )
  select store_id, order_id, courier_id, 'atribuida'::public.delivery_status, now()
  from courier_test_context
  returning id
)
update courier_test_context c set delivery_id = inserted.id from inserted;

-- ---------------------------------------------------------------------
-- Courier session and initial projection.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select courier_user_id::text from courier_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',(select courier_user_id::text from courier_test_context),'role','authenticated')::text,
  true
);

select is(
  public.get_my_courier_operational_context()->>'courierId',
  (select courier_id::text from courier_test_context),
  'sessao autenticada resolve o entregador correto'
);

select is(
  public.get_my_courier_operational_context()#>>'{activeDelivery,deliveryId}',
  (select delivery_id::text from courier_test_context),
  'contexto operacional aponta para a entrega atribuida'
);

select ok(
  (public.get_my_delivery_detail((select delivery_id from courier_test_context))->'allowedActions') ? 'confirm_arrival',
  'antes da chegada o servidor libera confirm_arrival'
);

select ok(
  not ((public.get_my_delivery_detail((select delivery_id from courier_test_context))->'allowedActions') ? 'confirm_pickup'),
  'antes da chegada o servidor ainda nao libera confirm_pickup'
);

select ok(
  (public.set_my_courier_online()->>'onlineIntent')::boolean,
  'entregador consegue ficar online pela RPC propria'
);

select is(
  public.heartbeat_my_courier_presence()->>'presenceStatus',
  'online',
  'heartbeat mantem presenca online'
);

-- ---------------------------------------------------------------------
-- Arrival: marker only. Delivery status must stay atribuida.
-- ---------------------------------------------------------------------
insert into courier_action_results (label, result)
select 'arrival', public.confirm_my_arrival_at_store(
  (select delivery_id from courier_test_context), 1, 'courier-arrival-0001'
);

select is(
  (select result->>'status' from courier_action_results where label='arrival'),
  'atribuida',
  'cheguei na loja nao inventa novo status'
);

reset role;
select is(
  (select status::text from public.deliveries where id=(select delivery_id from courier_test_context)),
  'atribuida',
  'status persistido continua atribuida apos chegada'
);
select ok(
  (select arrived_at_store_at is not null from public.deliveries where id=(select delivery_id from courier_test_context)),
  'chegada e persistida em arrived_at_store_at'
);
select is(
  (select version from public.deliveries where id=(select delivery_id from courier_test_context)),
  2,
  'chegada incrementa a versao uma unica vez'
);

set local role authenticated;
select ok(
  (public.get_my_delivery_detail((select delivery_id from courier_test_context))->'allowedActions') ? 'confirm_pickup',
  'depois da chegada o servidor libera confirm_pickup'
);
select ok(
  public.get_my_delivery_detail((select delivery_id from courier_test_context))->>'arrivedAtStoreAt' is not null,
  'detalhe publico devolve o marco de chegada'
);

select is(
  public.confirm_my_arrival_at_store(
    (select delivery_id from courier_test_context), 1, 'courier-arrival-0001'
  )->>'version',
  '2',
  'replay com a mesma chave idempotente devolve o primeiro resultado'
);

reset role;
select is(
  (select version from public.deliveries where id=(select delivery_id from courier_test_context)),
  2,
  'replay idempotente nao incrementa a versao novamente'
);

-- ---------------------------------------------------------------------
-- Pickup and start route.
-- ---------------------------------------------------------------------
set local role authenticated;
select is(
  public.confirm_my_order_pickup(
    (select delivery_id from courier_test_context), 2, 'courier-pickup-0001'
  )->>'status',
  'coletada',
  'confirmar coleta muda a delivery para coletada'
);

select is(
  public.start_my_delivery(
    (select delivery_id from courier_test_context), 3, 'courier-start-0001'
  )->>'status',
  'em_rota',
  'iniciar entrega muda a delivery para em_rota'
);

reset role;
select is(
  (select status::text from public.orders where id=(select order_id from courier_test_context)),
  'saiu_para_entrega',
  'iniciar rota sincroniza o pedido para saiu_para_entrega'
);

-- ---------------------------------------------------------------------
-- Blocking occurrence: event, not order status.
-- ---------------------------------------------------------------------
set local role authenticated;
insert into courier_action_results (label, result)
select 'occurrence', public.report_my_delivery_occurrence(
  (select delivery_id from courier_test_context),
  'customer_not_found',
  'Cliente nao localizado no endereco',
  4,
  'courier-occurrence-0001'
);

select ok(
  (select nullif(result->>'occurrenceId','') is not null from courier_action_results where label='occurrence'),
  'ocorrencia retorna identificador persistido'
);
select is(
  (select result->>'version' from courier_action_results where label='occurrence'),
  '5',
  'ocorrencia incrementa somente a versao da delivery'
);

reset role;
update courier_test_context c
   set occurrence_id = (select (r.result->>'occurrenceId')::uuid from courier_action_results r where r.label='occurrence');

select is(
  (select status::text from public.orders where id=(select order_id from courier_test_context)),
  'saiu_para_entrega',
  'ocorrencia nao vira estado do pedido'
);

set local role authenticated;
select throws_ok(
  format(
    'select public.complete_my_delivery(%L::uuid,5,%L)',
    (select delivery_id from courier_test_context),
    'courier-complete-blocked-0001'
  ),
  'P0001', 'OCCURRENCE_OPEN',
  'ocorrencia aberta de atencao da loja bloqueia conclusao'
);

reset role;
select is(
  (select status::text from public.deliveries where id=(select delivery_id from courier_test_context)),
  'em_rota',
  'tentativa bloqueada nao corrompe estado da delivery'
);

-- ---------------------------------------------------------------------
-- Store resolves the occurrence through its own public RPC.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_user_id::text from courier_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',(select owner_user_id::text from courier_test_context),'role','authenticated')::text,
  true
);

select is(
  jsonb_array_length(public.list_store_delivery_occurrences(
    (select store_id from courier_test_context),
    (select order_id from courier_test_context)
  )->'occurrences'),
  1,
  'loja enxerga a ocorrencia da propria entrega'
);

select is(
  public.resolve_store_delivery_occurrence(
    (select store_id from courier_test_context),
    (select occurrence_id from courier_test_context),
    1,
    'Cliente localizado pela loja'
  )->>'version',
  '2',
  'loja resolve a ocorrencia com controle de versao'
);

reset role;
select ok(
  (select resolved_at is not null from public.delivery_occurrences where id=(select occurrence_id from courier_test_context)),
  'ocorrencia fica efetivamente resolvida'
);

-- ---------------------------------------------------------------------
-- Courier completes after resolution.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', (select courier_user_id::text from courier_test_context), true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',(select courier_user_id::text from courier_test_context),'role','authenticated')::text,
  true
);

insert into courier_action_results (label, result)
select 'complete', public.complete_my_delivery(
  (select delivery_id from courier_test_context), 5, 'courier-complete-0001'
);

select is(
  (select result->>'status' from courier_action_results where label='complete'),
  'concluida',
  'entrega pode ser concluida depois da resolucao'
);

select is(
  public.complete_my_delivery(
    (select delivery_id from courier_test_context), 5, 'courier-complete-0001'
  )->>'version',
  '6',
  'replay da conclusao devolve resultado idempotente'
);

select throws_ok(
  format(
    'select public.complete_my_delivery(%L::uuid,6,%L)',
    (select delivery_id from courier_test_context),
    'courier-complete-again-0002'
  ),
  'P0001', 'INVALID_TRANSITION',
  'nova tentativa de concluir delivery finalizada e rejeitada'
);

reset role;
select ok(
  (select status='concluida'::public.delivery_status and completed_at is not null
     from public.deliveries where id=(select delivery_id from courier_test_context)),
  'delivery final persiste concluida com completed_at'
);

select is(
  (select status::text from public.orders where id=(select order_id from courier_test_context)),
  'entregue',
  'conclusao sincroniza o pedido para entregue'
);

select is(
  (select count(*) from public.order_status_history
    where order_id=(select order_id from courier_test_context)
      and action in ('start_delivery','complete_delivery')),
  2::bigint,
  'historico do pedido registra saida e conclusao pelo entregador'
);

select is(
  (select count(*) from public.courier_action_intents
    where courier_id=(select courier_id from courier_test_context)),
  5::bigint,
  'replays nao duplicam intents idempotentes'
);

select ok(
  (select count(*) >= 6 from public.delivery_events
    where delivery_id=(select delivery_id from courier_test_context)),
  'rastro operacional preserva chegada coleta rota ocorrencia resolucao e conclusao'
);

-- ---------------------------------------------------------------------
-- Acceptance-required mode: arrival cannot bypass explicit acceptance.
-- ---------------------------------------------------------------------
update public.stores
   set courier_acceptance_required = true
 where id=(select store_id from courier_test_context);

with inserted as (
  insert into public.orders (
    store_id, order_number, customer_name, customer_phone, fulfillment, status,
    address_snapshot, items_subtotal, delivery_fee, discount_total, total_amount,
    idempotency_key
  )
  select
    store_id, 910002, 'Cliente Aceite', '11999990403',
    'entrega'::public.fulfillment_type,
    'aguardando_entregador'::public.order_status,
    jsonb_build_object('street','Rua Aceite','number','20','neighborhood','Centro'),
    10, 5, 0, 15, 'courier-acceptance-order-0002'
  from courier_test_context
  returning id
)
update courier_test_context c set acceptance_order_id = inserted.id from inserted;

with inserted as (
  insert into public.deliveries (store_id, order_id, courier_id, status, assigned_at)
  select store_id, acceptance_order_id, courier_id, 'atribuida'::public.delivery_status, now()
  from courier_test_context
  returning id
)
update courier_test_context c set acceptance_delivery_id = inserted.id from inserted;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select courier_user_id::text from courier_test_context), true);

select ok(
  (public.get_my_delivery_detail((select acceptance_delivery_id from courier_test_context))->'allowedActions') ? 'accept',
  'modo de aceite explicito oferece accept antes da chegada'
);

select throws_ok(
  format(
    'select public.confirm_my_arrival_at_store(%L::uuid,1,%L)',
    (select acceptance_delivery_id from courier_test_context),
    'courier-arrival-before-accept-0002'
  ),
  'P0001', 'ACCEPTANCE_REQUIRED',
  'chegada nao pode contornar aceite explicito'
);

select is(
  public.accept_my_delivery_assignment(
    (select acceptance_delivery_id from courier_test_context), 1, 'courier-accept-0002'
  )->>'status',
  'aceita',
  'aceite explicito muda a delivery para aceita'
);

select is(
  public.confirm_my_arrival_at_store(
    (select acceptance_delivery_id from courier_test_context), 2, 'courier-arrival-after-accept-0002'
  )->>'status',
  'aceita',
  'chegada apos aceite continua sendo marco e nao novo status'
);

select ok(
  (public.get_my_delivery_detail((select acceptance_delivery_id from courier_test_context))->'allowedActions') ? 'confirm_pickup',
  'apos aceite e chegada o servidor libera confirm_pickup'
);

select * from finish();
rollback;
