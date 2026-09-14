begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_temp;

select plan(29);

create temp table courier_isolation_context (
  store_id uuid not null,
  user_a uuid not null,
  user_b uuid not null,
  courier_a uuid,
  courier_b uuid,
  order_a uuid,
  order_b uuid,
  delivery_a uuid,
  delivery_b uuid
);

grant select on courier_isolation_context to authenticated;

create temp table courier_isolation_results (
  label text primary key,
  result jsonb not null
);
grant select, insert on courier_isolation_results to authenticated;

insert into courier_isolation_context (store_id, user_a, user_b)
select
  id,
  '66666666-6666-4666-8666-666666666666'::uuid,
  '77777777-7777-4777-8777-777777777777'::uuid
from public.stores
where slug = 'brasa-urbana';

select ok(
  exists (select 1 from courier_isolation_context where store_id is not null),
  'loja deterministica existe para o ataque entre entregadores'
);

-- Auth identities are fixtures only. Runtime identity still comes from JWT.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select user_a, 'authenticated', 'authenticated', 'courier-a-isolation@example.test', '', now(), now(), now()
from courier_isolation_context
on conflict (id) do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select user_b, 'authenticated', 'authenticated', 'courier-b-isolation@example.test', '', now(), now(), now()
from courier_isolation_context
on conflict (id) do nothing;

insert into public.user_profiles (id, full_name, display_name, is_active)
select user_a, 'Courier A Isolation', 'Courier A', true from courier_isolation_context
on conflict (id) do update set is_active=true;
insert into public.user_profiles (id, full_name, display_name, is_active)
select user_b, 'Courier B Isolation', 'Courier B', true from courier_isolation_context
on conflict (id) do update set is_active=true;

insert into public.user_roles (user_id, store_id, role, is_active)
select user_a, store_id, 'entregador'::public.app_role, true from courier_isolation_context
on conflict do nothing;
insert into public.user_roles (user_id, store_id, role, is_active)
select user_b, store_id, 'entregador'::public.app_role, true from courier_isolation_context
on conflict do nothing;

with a as (
  insert into public.couriers (store_id,user_id,full_name,phone,status,is_online,can_accept_deliveries)
  select store_id,user_a,'Courier A Isolation','11999990501','ativo'::public.courier_status,true,true
  from courier_isolation_context returning id
)
update courier_isolation_context c set courier_a=a.id from a;

with b as (
  insert into public.couriers (store_id,user_id,full_name,phone,status,is_online,can_accept_deliveries)
  select store_id,user_b,'Courier B Isolation','11999990502','ativo'::public.courier_status,true,true
  from courier_isolation_context returning id
)
update courier_isolation_context c set courier_b=b.id from b;

insert into public.courier_auth_identities (
  store_id,courier_id,auth_user_id,login_identifier,synthetic_email,
  requires_password_change,is_login_enabled,password_changed_at
)
select store_id,courier_a,user_a,'courier.isolation.a',
       '66666666666646668666666666666666@courier.pediuaqui.internal',false,true,now()
from courier_isolation_context;

insert into public.courier_auth_identities (
  store_id,courier_id,auth_user_id,login_identifier,synthetic_email,
  requires_password_change,is_login_enabled,password_changed_at
)
select store_id,courier_b,user_b,'courier.isolation.b',
       '77777777777747778777777777777777@courier.pediuaqui.internal',false,true,now()
from courier_isolation_context;

update public.stores set courier_acceptance_required=false
where id=(select store_id from courier_isolation_context);

with a as (
  insert into public.orders (
    store_id,order_number,customer_name,customer_phone,fulfillment,status,address_snapshot,
    items_subtotal,delivery_fee,discount_total,total_amount,idempotency_key
  )
  select store_id,920001,'Cliente A','11999990511','entrega'::public.fulfillment_type,
         'aguardando_entregador'::public.order_status,
         jsonb_build_object('street','Rua A','number','1','neighborhood','Centro'),10,5,0,15,
         'courier-isolation-order-a'
  from courier_isolation_context returning id
)
update courier_isolation_context c set order_a=a.id from a;

with b as (
  insert into public.orders (
    store_id,order_number,customer_name,customer_phone,fulfillment,status,address_snapshot,
    items_subtotal,delivery_fee,discount_total,total_amount,idempotency_key
  )
  select store_id,920002,'Cliente B','11999990512','entrega'::public.fulfillment_type,
         'aguardando_entregador'::public.order_status,
         jsonb_build_object('street','Rua B','number','2','neighborhood','Centro'),10,5,0,15,
         'courier-isolation-order-b'
  from courier_isolation_context returning id
)
update courier_isolation_context c set order_b=b.id from b;

with a as (
  insert into public.deliveries (store_id,order_id,courier_id,status,assigned_at)
  select store_id,order_a,courier_a,'atribuida'::public.delivery_status,now()
  from courier_isolation_context returning id
)
update courier_isolation_context c set delivery_a=a.id from a;

with b as (
  insert into public.deliveries (store_id,order_id,courier_id,status,assigned_at)
  select store_id,order_b,courier_b,'atribuida'::public.delivery_status,now()
  from courier_isolation_context returning id
)
update courier_isolation_context c set delivery_b=b.id from b;

-- ---------------------------------------------------------------------
-- Courier A: own context, then attempts to read/mutate B's delivery.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_a::text from courier_isolation_context),true);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_a::text from courier_isolation_context),'role','authenticated')::text,true);

select is(
  public.get_my_courier_operational_context()->>'courierId',
  (select courier_a::text from courier_isolation_context),
  'JWT A resolve somente o entregador A'
);
select is(
  public.get_my_courier_operational_context()#>>'{activeDelivery,deliveryId}',
  (select delivery_a::text from courier_isolation_context),
  'contexto de A aponta somente para delivery A'
);

select throws_ok(
  format('select public.get_my_delivery_detail(%L::uuid)',(select delivery_b from courier_isolation_context)),
  'P0001','NOT_FOUND',
  'A nao consegue ler detalhe da delivery B mesmo conhecendo o UUID'
);
select throws_ok(
  format('select public.confirm_my_arrival_at_store(%L::uuid,1,%L)',
         (select delivery_b from courier_isolation_context),'attack-a-arrival-b-0001'),
  'P0001','NOT_FOUND',
  'A nao consegue marcar chegada na delivery B'
);
select throws_ok(
  format('select public.report_my_delivery_occurrence(%L::uuid,%L,%L,1,%L)',
         (select delivery_b from courier_isolation_context),'customer_not_found','ataque A em B','attack-a-occ-b-0001'),
  'P0001','NOT_FOUND',
  'A nao consegue criar ocorrencia na delivery B'
);

-- ---------------------------------------------------------------------
-- Courier B: symmetric attacks against A.
-- ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub',(select user_b::text from courier_isolation_context),true);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_b::text from courier_isolation_context),'role','authenticated')::text,true);

select is(
  public.get_my_courier_operational_context()->>'courierId',
  (select courier_b::text from courier_isolation_context),
  'JWT B resolve somente o entregador B'
);
select is(
  public.get_my_courier_operational_context()#>>'{activeDelivery,deliveryId}',
  (select delivery_b::text from courier_isolation_context),
  'contexto de B aponta somente para delivery B'
);
select throws_ok(
  format('select public.get_my_delivery_detail(%L::uuid)',(select delivery_a from courier_isolation_context)),
  'P0001','NOT_FOUND',
  'B nao consegue ler detalhe da delivery A'
);
select throws_ok(
  format('select public.confirm_my_order_pickup(%L::uuid,1,%L)',
         (select delivery_a from courier_isolation_context),'attack-b-pickup-a-0001'),
  'P0001','NOT_FOUND',
  'B nao consegue coletar delivery A'
);

reset role;
select is(
  (select version from public.deliveries where id=(select delivery_a from courier_isolation_context)),
  1,
  'ataques de B nao alteram version da delivery A'
);
select is(
  (select version from public.deliveries where id=(select delivery_b from courier_isolation_context)),
  1,
  'ataques de A nao alteram version da delivery B'
);

-- ---------------------------------------------------------------------
-- Same idempotency key across different couriers must remain isolated.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_a::text from courier_isolation_context),true);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_a::text from courier_isolation_context),'role','authenticated')::text,true);

insert into courier_isolation_results(label,result)
select 'arrival_a',public.confirm_my_arrival_at_store(
  (select delivery_a from courier_isolation_context),1,'shared-arrival-key-0001');

select is(
  (select result->>'deliveryId' from courier_isolation_results where label='arrival_a'),
  (select delivery_a::text from courier_isolation_context),
  'A recebe resultado da propria delivery usando chave compartilhada'
);
select is(
  (select result->>'status' from courier_isolation_results where label='arrival_a'),
  'atribuida',
  'chegada de A permanece marco sem novo status'
);

select set_config('request.jwt.claim.sub',(select user_b::text from courier_isolation_context),true);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_b::text from courier_isolation_context),'role','authenticated')::text,true);

insert into courier_isolation_results(label,result)
select 'arrival_b',public.confirm_my_arrival_at_store(
  (select delivery_b from courier_isolation_context),1,'shared-arrival-key-0001');

select is(
  (select result->>'deliveryId' from courier_isolation_results where label='arrival_b'),
  (select delivery_b::text from courier_isolation_context),
  'B pode usar a mesma chave sem receber resultado de A'
);
select is(
  (select result->>'status' from courier_isolation_results where label='arrival_b'),
  'atribuida',
  'chegada de B permanece independente'
);

reset role;
select ok(
  (select arrived_at_store_at is not null from public.deliveries where id=(select delivery_a from courier_isolation_context))
  and
  (select arrived_at_store_at is not null from public.deliveries where id=(select delivery_b from courier_isolation_context)),
  'as duas chegadas foram persistidas apenas em suas proprias deliveries'
);
select ok(
  (select version=2 from public.deliveries where id=(select delivery_a from courier_isolation_context))
  and
  (select version=2 from public.deliveries where id=(select delivery_b from courier_isolation_context)),
  'as duas deliveries avancaram exatamente uma versao'
);
select is(
  (select count(*) from public.courier_action_intents where idempotency_key='shared-arrival-key-0001'),
  2::bigint,
  'mesma chave gera duas intents isoladas por courier_id'
);
select is(
  (select delivery_id from public.courier_action_intents
    where courier_id=(select courier_a from courier_isolation_context)
      and idempotency_key='shared-arrival-key-0001'),
  (select delivery_a from courier_isolation_context),
  'intent de A referencia apenas delivery A'
);
select is(
  (select delivery_id from public.courier_action_intents
    where courier_id=(select courier_b from courier_isolation_context)
      and idempotency_key='shared-arrival-key-0001'),
  (select delivery_b from courier_isolation_context),
  'intent de B referencia apenas delivery B'
);
select is(
  (select count(*) from public.delivery_events
    where delivery_id=(select delivery_b from courier_isolation_context)
      and courier_id=(select courier_a from courier_isolation_context)),
  0::bigint,
  'nenhum evento de A foi gravado na delivery B'
);
select is(
  (select count(*) from public.delivery_events
    where delivery_id=(select delivery_a from courier_isolation_context)
      and courier_id=(select courier_b from courier_isolation_context)),
  0::bigint,
  'nenhum evento de B foi gravado na delivery A'
);

-- ---------------------------------------------------------------------
-- Idempotency key must be bound to the original action/delivery.
-- A reused key for a different request must conflict, never replay stale data.
-- These assertions intentionally expose the current contract if it is weak.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub',(select user_a::text from courier_isolation_context),true);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_a::text from courier_isolation_context),'role','authenticated')::text,true);

select throws_ok(
  format('select public.confirm_my_order_pickup(%L::uuid,2,%L)',
         (select delivery_a from courier_isolation_context),'shared-arrival-key-0001'),
  'P0001','IDEMPOTENCY_CONFLICT',
  'mesma chave nao pode ser reutilizada por A para outra acao'
);
select throws_ok(
  format('select public.confirm_my_order_pickup(%L::uuid,2,%L)',
         (select delivery_b from courier_isolation_context),'shared-arrival-key-0001'),
  'P0001','IDEMPOTENCY_CONFLICT',
  'chave existente de A nao pode mascarar tentativa contra delivery B'
);

reset role;
select is(
  (select status::text from public.deliveries where id=(select delivery_a from courier_isolation_context)),
  'atribuida',
  'reuso conflitante nao altera estado da delivery A'
);
select is(
  (select status::text from public.deliveries where id=(select delivery_b from courier_isolation_context)),
  'atribuida',
  'reuso conflitante nao altera estado da delivery B'
);

set local role authenticated;
select ok(
  (public.get_my_delivery_detail((select delivery_a from courier_isolation_context))->'allowedActions') ? 'confirm_pickup',
  'A continua com a acao correta depois dos ataques e conflitos'
);
select set_config('request.jwt.claim.sub',(select user_b::text from courier_isolation_context),true);
select ok(
  (public.get_my_delivery_detail((select delivery_b from courier_isolation_context))->'allowedActions') ? 'confirm_pickup',
  'B continua com a acao correta depois dos ataques e conflitos'
);

select * from finish();
rollback;
