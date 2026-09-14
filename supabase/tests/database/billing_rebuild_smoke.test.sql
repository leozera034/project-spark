begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, private, extensions, pg_temp;

select plan(23);

create temp table billing_smoke_context (
  admin_user_id uuid not null,
  owner_user_id uuid not null,
  store_id uuid,
  subscription_id uuid,
  payment_id uuid
);

grant select on billing_smoke_context to authenticated;

create temp table billing_smoke_results (
  label text primary key,
  result jsonb not null
);
grant select, insert on billing_smoke_results to authenticated;

insert into billing_smoke_context (admin_user_id, owner_user_id)
values (
  'e0db8a21-3d8e-4d94-99a5-2acd57f4b30a'::uuid,
  '88888888-8888-4888-8888-888888888888'::uuid
);

select ok(
  exists (
    select 1 from public.plans
     where is_active
       and monthly_amount_cents = round(monthly_price * 100)::integer
       and monthly_amount_cents >= 0
  ),
  'plans legados foram backfillados para centavos'
);

-- Provisiona uma loja real pela saga final do histórico reconstruído.
with provisioned as (
  select public.provision_store_with_owner(
    'billing-smoke-provision-0001',
    'billing-smoke-request-hash-v1',
    (select owner_user_id from billing_smoke_context),
    'Owner Billing Smoke',
    'Billing Smoke Loja',
    'billing-smoke-loja',
    'Goiânia',
    'GO',
    'restaurante',
    '62999990601',
    'essencial',
    'qa_rebuild',
    null
  ) as result
)
update billing_smoke_context c
   set store_id = (provisioned.result->>'store_id')::uuid
  from provisioned;

select ok(
  (select store_id is not null from billing_smoke_context),
  'provisionamento retorna store_id'
);

select is(
  (select slug from public.stores where id=(select store_id from billing_smoke_context)),
  'billing-smoke-loja',
  'loja provisionada persiste com slug esperado'
);

update billing_smoke_context c
   set subscription_id = (
     select sub.id from public.store_subscriptions sub
      where sub.store_id = c.store_id
      order by sub.created_at desc limit 1
   );

select is(
  (select count(*) from public.store_subscriptions where store_id=(select store_id from billing_smoke_context)),
  1::bigint,
  'provisionamento cria exatamente uma assinatura'
);

select is(
  (select status::text from public.store_subscriptions where id=(select subscription_id from billing_smoke_context)),
  'cortesia',
  'nova loja inicia em cortesia/trial'
);

select ok(
  (select current_period_start is not null from public.store_subscriptions where id=(select subscription_id from billing_smoke_context)),
  'trial possui current_period_start moderno'
);

select ok(
  (select trial_end > current_period_start from public.store_subscriptions where id=(select subscription_id from billing_smoke_context)),
  'trial_end fica no futuro em relação ao início'
);

select ok(
  (select next_billing_date = trial_end from public.store_subscriptions where id=(select subscription_id from billing_smoke_context)),
  'next_billing_date coincide com o fim do trial inicial'
);

select ok(
  (select p.monthly_amount_cents = round(p.monthly_price * 100)::integer
     from public.store_subscriptions sub
     join public.plans p on p.id=sub.plan_id
    where sub.id=(select subscription_id from billing_smoke_context)),
  'assinatura aponta para plano com preço legado e centavos coerentes'
);

select ok(
  (public.provision_store_with_owner(
    'billing-smoke-provision-0001',
    'billing-smoke-request-hash-v1',
    (select owner_user_id from billing_smoke_context),
    'Owner Billing Smoke',
    'Billing Smoke Loja',
    'billing-smoke-loja',
    'Goiânia',
    'GO',
    'restaurante',
    '62999990601',
    'essencial',
    'qa_rebuild',
    null
  )->>'already_provisioned')::boolean,
  'replay do provisionamento é idempotente'
);

select is(
  (select count(*) from public.stores where slug='billing-smoke-loja'),
  1::bigint,
  'replay não duplica a loja'
);

-- A fixture QA já criou perfil/role admin; adicionamos apenas a identidade Auth
-- necessária para created_by/registered_by do ledger financeiro.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select admin_user_id, 'authenticated', 'authenticated', 'billing-admin-smoke@example.test', '', now(), now(), now()
from billing_smoke_context
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select admin_user_id::text from billing_smoke_context),true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',(select admin_user_id::text from billing_smoke_context),'role','authenticated')::text,
  true
);

select is(
  auth.uid(),
  (select admin_user_id from billing_smoke_context),
  'sessão administrativa resolve o ator esperado'
);

insert into billing_smoke_results(label,result)
select 'list', public.list_platform_subscriptions('Billing Smoke',null,50,0)::jsonb;

select is(
  (select (result->>'total')::integer from billing_smoke_results where label='list'),
  1,
  'admin lista a assinatura provisionada pela RPC pública'
);

select is(
  (select result#>>'{items,0,store_slug}' from billing_smoke_results where label='list'),
  'billing-smoke-loja',
  'RPC pública de billing devolve a loja correta'
);

with paid as (
  select public.register_manual_payment(
    (select subscription_id from billing_smoke_context),
    9900,
    100,
    'pix_manual'::public.payment_method,
    'Pagamento smoke rebuild'
  ) as id
)
update billing_smoke_context c set payment_id=paid.id from paid;

select ok(
  (select payment_id is not null from billing_smoke_context),
  'pagamento manual retorna identificador'
);

reset role;

select ok(
  (select amount_due_cents=10000
       and amount_paid_cents=9900
       and discount_amount_cents=100
       and currency='BRL'
     from public.subscription_payments
    where id=(select payment_id from billing_smoke_context)),
  'ledger preserva obrigação, valor pago e desconto em centavos'
);

select ok(
  (select amount=99.00::numeric
       and status='pago'::public.subscription_payment_status
       and payment_method='pix_manual'::public.payment_method
       and method_note='pix_manual'
       and audit_immutable
     from public.subscription_payments
    where id=(select payment_id from billing_smoke_context)),
  'ponte legada e contrato moderno permanecem coerentes no pagamento'
);

select is(
  (select status::text from public.store_subscriptions where id=(select subscription_id from billing_smoke_context)),
  'ativa',
  'pagamento manual ativa a assinatura'
);

select ok(
  (select version=2 and next_billing_date > current_period_start
     from public.store_subscriptions
    where id=(select subscription_id from billing_smoke_context)),
  'pagamento avança versão e próximo período'
);

select throws_ok(
  format(
    'update public.subscription_payments set notes=%L where id=%L::uuid',
    'tentativa de mutação',
    (select payment_id from billing_smoke_context)
  ),
  'P0001',
  'Audit log entries are immutable and cannot be modified or deleted.',
  'ledger de pagamentos rejeita UPDATE após criação'
);

-- Proprietário comum não pode usar superfícies de billing da plataforma.
set local role authenticated;
select set_config('request.jwt.claim.sub',(select owner_user_id::text from billing_smoke_context),true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub',(select owner_user_id::text from billing_smoke_context),'role','authenticated')::text,
  true
);

select throws_ok(
  $$select public.list_platform_subscriptions('Billing Smoke',null,50,0)$$,
  'P0001', 'FORBIDDEN',
  'proprietário comum não lista billing da plataforma'
);

select throws_ok(
  format(
    'select public.register_manual_payment(%L::uuid,100,0,%L::public.payment_method,null)',
    (select subscription_id from billing_smoke_context),
    'cash'
  ),
  'P0001', 'FORBIDDEN',
  'proprietário comum não registra pagamento administrativo'
);

select * from finish();
rollback;
