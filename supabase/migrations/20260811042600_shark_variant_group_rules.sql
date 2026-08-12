-- SHARK — regras de grupos por tamanho/variação.
-- Permite, por exemplo, Açaí 300 ml com 3 complementos incluídos e 500 ml com 5,
-- sem duplicar o grupo de Complementos.

create table if not exists public.product_variant_option_group_rules (
  store_id uuid not null,
  product_id uuid not null,
  product_variant_id uuid not null,
  option_group_id uuid not null,
  min_selections integer,
  max_selections integer,
  included_selections integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id, product_variant_id, option_group_id),
  constraint pvogr_min_check check (min_selections is null or min_selections between 0 and 100),
  constraint pvogr_max_check check (max_selections is null or max_selections between 1 and 100),
  constraint pvogr_included_check check (included_selections is null or included_selections between 0 and 100),
  constraint pvogr_bounds_check check (min_selections is null or max_selections is null or min_selections <= max_selections),
  constraint pvogr_included_bounds_check check (included_selections is null or max_selections is null or included_selections <= max_selections)
);

create index if not exists idx_pvogr_variant on public.product_variant_option_group_rules(store_id, product_variant_id);
create index if not exists idx_pvogr_group on public.product_variant_option_group_rules(store_id, option_group_id);

alter table public.product_variant_option_group_rules enable row level security;
revoke all on table public.product_variant_option_group_rules from anon, authenticated;

create or replace function public.list_product_variant_group_rules(
  _store_id uuid,
  _product_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_variant_id',r.product_variant_id,
      'option_group_id',r.option_group_id,
      'min_selections',r.min_selections,
      'max_selections',r.max_selections,
      'included_selections',r.included_selections,
      'updated_at',r.updated_at
    ) order by r.product_variant_id,r.option_group_id)
    from public.product_variant_option_group_rules r
    where r.store_id=_sid and r.product_id=_product_id
  ),'[]'::jsonb);
end;
$$;

create or replace function public.upsert_product_variant_group_rule(
  _store_id uuid,
  _product_id uuid,
  _product_variant_id uuid,
  _option_group_id uuid,
  _min_selections integer default null,
  _max_selections integer default null,
  _included_selections integer default null
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _row public.product_variant_option_group_rules;
begin
  perform private.require_permission('catalog.update',_sid);

  if not exists(
    select 1 from public.product_variants v
    where v.id=_product_variant_id and v.product_id=_product_id and v.store_id=_sid and not v.is_archived
  ) then raise exception 'VARIANT_INVALID'; end if;

  if not exists(
    select 1 from public.product_option_groups pog
    join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
    where pog.store_id=_sid and pog.product_id=_product_id and pog.option_group_id=_option_group_id
      and not pog.is_archived and not og.is_archived
  ) then raise exception 'GROUP_INVALID'; end if;

  if _min_selections is not null and (_min_selections<0 or _min_selections>100) then raise exception 'INVALID_MIN'; end if;
  if _max_selections is not null and (_max_selections<1 or _max_selections>100) then raise exception 'INVALID_MAX'; end if;
  if _included_selections is not null and (_included_selections<0 or _included_selections>100) then raise exception 'INVALID_INCLUDED'; end if;
  if _min_selections is not null and _max_selections is not null and _min_selections>_max_selections then raise exception 'INVALID_BOUNDS'; end if;
  if _included_selections is not null and _max_selections is not null and _included_selections>_max_selections then raise exception 'INVALID_INCLUDED_BOUNDS'; end if;

  insert into public.product_variant_option_group_rules(
    store_id,product_id,product_variant_id,option_group_id,min_selections,max_selections,included_selections
  ) values(
    _sid,_product_id,_product_variant_id,_option_group_id,_min_selections,_max_selections,_included_selections
  )
  on conflict (store_id,product_id,product_variant_id,option_group_id)
  do update set
    min_selections=excluded.min_selections,
    max_selections=excluded.max_selections,
    included_selections=excluded.included_selections,
    updated_at=now()
  returning * into _row;

  perform private.log_config_audit(_sid,'catalog.variant.group_rule.updated','product_variant_option_group_rules',_product_variant_id,array['min_selections','max_selections','included_selections']);

  return jsonb_build_object(
    'product_variant_id',_row.product_variant_id,
    'option_group_id',_row.option_group_id,
    'min_selections',_row.min_selections,
    'max_selections',_row.max_selections,
    'included_selections',_row.included_selections,
    'updated_at',_row.updated_at
  );
end;
$$;

grant execute on function public.list_product_variant_group_rules(uuid,uuid) to authenticated;
grant execute on function public.upsert_product_variant_group_rule(uuid,uuid,uuid,uuid,integer,integer,integer) to authenticated;
revoke all on function public.list_product_variant_group_rules(uuid,uuid) from anon;
revoke all on function public.upsert_product_variant_group_rule(uuid,uuid,uuid,uuid,integer,integer,integer) from anon;

-- Projeção server-only das regras por tamanho para o configurador público.
create or replace function public.storefront_variant_group_rules(_slug text,_product_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare _store_id uuid;
begin
  select s.id into _store_id from public.stores s
  where s.slug=public.storefront_normalize_slug(_slug) and s.status='ativa' limit 1;
  if _store_id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_variant_id',r.product_variant_id,
      'option_group_id',r.option_group_id,
      'min_selections',r.min_selections,
      'max_selections',r.max_selections,
      'included_selections',r.included_selections
    ))
    from public.product_variant_option_group_rules r
    where r.store_id=_store_id and r.product_id=_product_id
  ),'[]'::jsonb);
end;
$$;

revoke all on function public.storefront_variant_group_rules(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_variant_group_rules(text,uuid) to service_role;
