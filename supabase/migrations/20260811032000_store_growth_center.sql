-- Centro de Crescimento: CRM, marketing, analytics e automacoes da loja.
-- Mantem dados de cliente isolados por tenant e nunca os expoe ao admin da plataforma.

create table if not exists public.store_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  audience text not null default 'todos' check (audience in ('todos','novos','recorrentes','vip','inativos')),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  message text not null check (char_length(trim(message)) between 1 and 1200),
  status text not null default 'rascunho' check (status in ('rascunho','pronta','arquivada')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_marketing_campaigns_store_updated_idx
  on public.store_marketing_campaigns(store_id, updated_at desc);

create table if not exists public.store_automation_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  event_code text not null check (event_code in ('novo_cliente','pedido_concluido','cliente_inativo_30d','cliente_vip')),
  action_code text not null default 'sugerir_whatsapp' check (action_code in ('sugerir_whatsapp','criar_tarefa')),
  name text not null check (char_length(trim(name)) between 2 and 120),
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, event_code, name)
);

create index if not exists store_automation_rules_store_idx
  on public.store_automation_rules(store_id, is_enabled, event_code);

alter table public.store_marketing_campaigns enable row level security;
alter table public.store_automation_rules enable row level security;

grant select, insert, update, delete on public.store_marketing_campaigns to authenticated;
grant select, insert, update, delete on public.store_automation_rules to authenticated;
grant all on public.store_marketing_campaigns, public.store_automation_rules to service_role;

create policy store_marketing_campaigns_member_select on public.store_marketing_campaigns
  for select to authenticated using (private.is_store_member(store_id));
create policy store_marketing_campaigns_manager_write on public.store_marketing_campaigns
  for all to authenticated using (private.is_store_manager(store_id)) with check (private.is_store_manager(store_id));

create policy store_automation_rules_member_select on public.store_automation_rules
  for select to authenticated using (private.is_store_member(store_id));
create policy store_automation_rules_manager_write on public.store_automation_rules
  for all to authenticated using (private.is_store_manager(store_id)) with check (private.is_store_manager(store_id));

create or replace function public.get_store_growth_summary(_store_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not private.is_store_member(_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'customers', count(*),
    'newCustomers30d', count(*) filter (where c.created_at >= now() - interval '30 days'),
    'repeatCustomers', count(*) filter (where c.orders_count >= 2),
    'vipCustomers', count(*) filter (where c.orders_count >= 5),
    'inactiveCustomers', count(*) filter (where c.last_order_at < now() - interval '30 days'),
    'orders30d', coalesce((select count(*) from public.orders o where o.store_id = _store_id and o.created_at >= now() - interval '30 days' and o.status not in ('cancelado','rejeitado')),0),
    'revenue30d', coalesce((select sum(o.total_amount) from public.orders o where o.store_id = _store_id and o.created_at >= now() - interval '30 days' and o.status = 'concluido'),0),
    'avgTicket30d', coalesce((select avg(o.total_amount) from public.orders o where o.store_id = _store_id and o.created_at >= now() - interval '30 days' and o.status = 'concluido'),0)
  ) into result
  from public.customers c
  where c.store_id = _store_id;

  return coalesce(result, '{}'::jsonb);
end;
$$;

create or replace function public.list_store_customer_insights(
  _store_id uuid,
  _search text default null,
  _segment text default null,
  _limit integer default 100,
  _offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not private.is_store_member(_store_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with ranked as (
    select
      c.id, c.first_name, c.phone, c.orders_count, c.last_order_at, c.created_at,
      coalesce(sum(o.total_amount) filter (where o.status = 'concluido'), 0)::numeric(12,2) as lifetime_value,
      case
        when c.orders_count >= 5 then 'vip'
        when c.last_order_at is not null and c.last_order_at < now() - interval '30 days' then 'inativos'
        when c.orders_count >= 2 then 'recorrentes'
        else 'novos'
      end as segment
    from public.customers c
    left join public.orders o on o.store_id = c.store_id and o.customer_id = c.id
    where c.store_id = _store_id
    group by c.id
  ), filtered as (
    select * from ranked
    where (_search is null or trim(_search) = '' or first_name ilike '%' || trim(_search) || '%' or phone ilike '%' || trim(_search) || '%')
      and (_segment is null or trim(_segment) = '' or segment = _segment)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.lifetime_value desc, x.last_order_at desc nulls last)
      from (select * from filtered limit least(greatest(_limit,1),200) offset greatest(_offset,0)) x), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_store_revenue_series(_store_id uuid, _days integer default 30)
returns table(day date, orders bigint, revenue numeric, avg_ticket numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with guard as (
    select case when private.is_store_member(_store_id) then true else (select public.raise_forbidden()) end ok
  ), days as (
    select generate_series(current_date - (least(greatest(_days,7),90) - 1), current_date, interval '1 day')::date day
  )
  select d.day,
         count(o.id) filter (where o.status not in ('cancelado','rejeitado'))::bigint as orders,
         coalesce(sum(o.total_amount) filter (where o.status = 'concluido'),0)::numeric as revenue,
         coalesce(avg(o.total_amount) filter (where o.status = 'concluido'),0)::numeric as avg_ticket
  from days d
  cross join guard
  left join public.orders o on o.store_id = _store_id and o.created_at >= d.day and o.created_at < d.day + interval '1 day'
  group by d.day
  order by d.day;
$$;

-- Helper seguro para funcoes SQL que precisam abortar sem PL/pgSQL.
create or replace function public.raise_forbidden()
returns boolean language plpgsql volatile security definer set search_path = public, pg_temp
as $$ begin raise exception 'forbidden' using errcode='42501'; end $$;

revoke all on function public.raise_forbidden() from public, anon, authenticated;

grant execute on function public.get_store_growth_summary(uuid) to authenticated;
grant execute on function public.list_store_customer_insights(uuid,text,text,integer,integer) to authenticated;
grant execute on function public.get_store_revenue_series(uuid,integer) to authenticated;
revoke all on function public.get_store_growth_summary(uuid) from anon;
revoke all on function public.list_store_customer_insights(uuid,text,text,integer,integer) from anon;
revoke all on function public.get_store_revenue_series(uuid,integer) from anon;
