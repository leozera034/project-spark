create table if not exists public.professional_services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer check (price_cents is null or price_cents > 0),
  currency text not null default 'brl',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_service_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  service_id uuid not null references public.professional_services(id),
  requested_by uuid not null references auth.users(id),
  status text not null default 'requested' check (status in ('requested','awaiting_payment','paid','in_progress','delivered','cancelled','refunded')),
  price_cents integer,
  currency text not null default 'brl',
  notes text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  checkout_url text,
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  in_progress_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists professional_service_orders_store_idx on public.professional_service_orders(store_id, requested_at desc);
create index if not exists professional_service_orders_status_idx on public.professional_service_orders(status, requested_at desc);

alter table public.professional_services enable row level security;
alter table public.professional_service_orders enable row level security;

insert into public.professional_services(code,name,description,price_cents,currency,is_active,sort_order)
values ('menu_implementation','Comandiva monta meu cardápio','Nossa equipe configura categorias, produtos, opções, adicionais e estrutura inicial do cardápio com base nas informações fornecidas pela loja.',null,'brl',true,10)
on conflict (code) do update set name=excluded.name, description=excluded.description, is_active=true, updated_at=now();

create or replace function public.list_professional_services(_store_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare _sid uuid;
begin
  _sid:=private.resolve_store(_store_id);
  perform private.require_permission('catalog.view',_sid);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'code',s.code,'name',s.name,'description',s.description,'price_cents',s.price_cents,
    'currency',s.currency,'is_active',s.is_active,'sort_order',s.sort_order,
    'latest_order',(select jsonb_build_object('id',o.id,'status',o.status,'price_cents',o.price_cents,'requested_at',o.requested_at,'paid_at',o.paid_at,'in_progress_at',o.in_progress_at,'delivered_at',o.delivered_at) from public.professional_service_orders o where o.store_id=_sid and o.service_id=s.id order by o.requested_at desc limit 1)
  ) order by s.sort_order,s.name) from public.professional_services s where s.is_active),'[]'::jsonb);
end;$$;

create or replace function public.request_professional_service(_store_id uuid,_service_code text,_notes text default null)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id); _svc public.professional_services; _row public.professional_service_orders; _notes_clean text;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _svc from public.professional_services where code=_service_code and is_active for update;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
  if _svc.price_cents is null then raise exception 'SERVICE_PRICE_NOT_CONFIGURED'; end if;
  if exists(select 1 from public.professional_service_orders where store_id=_sid and service_id=_svc.id and status in ('requested','awaiting_payment','paid','in_progress')) then raise exception 'SERVICE_ORDER_ALREADY_OPEN'; end if;
  _notes_clean:=nullif(btrim(coalesce(_notes,'')),'');
  insert into public.professional_service_orders(store_id,service_id,requested_by,status,price_cents,currency,notes)
  values(_sid,_svc.id,auth.uid(),'awaiting_payment',_svc.price_cents,_svc.currency,_notes_clean) returning * into _row;
  perform private.log_config_audit(_sid,'professional_service.requested','professional_service_orders',_row.id,array['service_id','price_cents','status']);
  return jsonb_build_object('id',_row.id,'status',_row.status,'price_cents',_row.price_cents,'currency',_row.currency,'service_code',_svc.code,'service_name',_svc.name);
end;$$;

create or replace function public.list_store_professional_service_orders(_store_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'service_id',o.service_id,'service_code',s.code,'service_name',s.name,'status',o.status,'price_cents',o.price_cents,'currency',o.currency,'notes',o.notes,'requested_at',o.requested_at,'paid_at',o.paid_at,'in_progress_at',o.in_progress_at,'delivered_at',o.delivered_at) order by o.requested_at desc) from public.professional_service_orders o join public.professional_services s on s.id=o.service_id where o.store_id=_sid),'[]'::jsonb);
end;$$;

create or replace function public.admin_list_professional_services()
returns jsonb language plpgsql stable security definer set search_path=public,private,pg_temp as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order,s.name) from public.professional_services s),'[]'::jsonb);
end;$$;

create or replace function public.admin_update_professional_service(_service_id uuid,_price_cents integer,_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _row public.professional_services;
begin
  if not public.is_platform_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if _price_cents is null or _price_cents<=0 then raise exception 'INVALID_PRICE'; end if;
  update public.professional_services set price_cents=_price_cents,is_active=coalesce(_is_active,true),updated_at=now() where id=_service_id returning * into _row;
  if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
  return to_jsonb(_row);
end;$$;

grant execute on function public.list_professional_services(uuid) to authenticated;
grant execute on function public.request_professional_service(uuid,text,text) to authenticated;
grant execute on function public.list_store_professional_service_orders(uuid) to authenticated;
grant execute on function public.admin_list_professional_services() to authenticated;
grant execute on function public.admin_update_professional_service(uuid,integer,boolean) to authenticated;
