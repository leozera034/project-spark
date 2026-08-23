alter table public.products
  add column if not exists search_aliases text[] not null default '{}'::text[];

create or replace function private.normalize_product_search_aliases(_aliases text[])
returns text[]
language plpgsql
immutable
set search_path to ''
as $function$
declare
  _result text[];
begin
  select coalesce(array_agg(value order by first_position),'{}'::text[])
    into _result
    from (
      select normalized as value,min(ordinality)::int as first_position
        from unnest(coalesce(_aliases,'{}'::text[])) with ordinality as raw(value,ordinality)
        cross join lateral (select public.normalize_label(raw.value) as normalized) n
       where n.normalized<>''
       group by normalized
    ) aliases;

  if cardinality(_result)>12 then
    raise exception 'TOO_MANY_SEARCH_ALIASES' using errcode='P0001';
  end if;
  if exists(select 1 from unnest(_result) alias where length(alias)>40) then
    raise exception 'SEARCH_ALIAS_TOO_LONG' using errcode='P0001';
  end if;
  return _result;
end;
$function$;

create or replace function private.normalize_product_search_aliases_trigger()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.search_aliases:=private.normalize_product_search_aliases(new.search_aliases);
  return new;
end;
$function$;

drop trigger if exists trg_normalize_product_search_aliases on public.products;
create trigger trg_normalize_product_search_aliases
before insert or update of search_aliases on public.products
for each row execute function private.normalize_product_search_aliases_trigger();

update public.products
   set search_aliases=private.normalize_product_search_aliases(search_aliases)
 where search_aliases is distinct from private.normalize_product_search_aliases(search_aliases);

create index if not exists products_search_aliases_gin
  on public.products using gin(search_aliases);

create or replace function public.list_catalog_product_search_aliases(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_id',p.id,
      'name',p.name,
      'category_id',p.category_id,
      'category_name',c.name,
      'search_aliases',to_jsonb(p.search_aliases),
      'updated_at',p.updated_at
    ) order by p.sort_order,p.name,p.id)
      from public.products p
      left join public.categories c on c.id=p.category_id and c.store_id=p.store_id
     where p.store_id=_sid and not p.is_archived
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.update_catalog_product_search_aliases(
  _store_id uuid,
  _product_id uuid,
  _aliases text[]
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _product public.products;
  _normalized text[];
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _product
    from public.products p
   where p.store_id=_sid and p.id=_product_id
   for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0001'; end if;
  if _product.is_archived then raise exception 'PRODUCT_ARCHIVED' using errcode='P0001'; end if;

  _normalized:=private.normalize_product_search_aliases(_aliases);
  update public.products p
     set search_aliases=_normalized
   where p.store_id=_sid and p.id=_product_id
   returning * into _product;

  perform private.log_config_audit(_sid,'catalog.product.search_aliases_changed','products',_product_id,array['search_aliases']);
  return jsonb_build_object(
    'product_id',_product.id,
    'name',_product.name,
    'category_id',_product.category_id,
    'search_aliases',to_jsonb(_product.search_aliases),
    'updated_at',_product.updated_at
  );
end;
$function$;

revoke all on function public.list_catalog_product_search_aliases(uuid) from public, anon;
revoke all on function public.update_catalog_product_search_aliases(uuid,uuid,text[]) from public, anon;
grant execute on function public.list_catalog_product_search_aliases(uuid) to authenticated, service_role;
grant execute on function public.update_catalog_product_search_aliases(uuid,uuid,text[]) to authenticated, service_role;

create or replace function public.storefront_catalog_enrichment(_slug text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  _store_id uuid;
begin
  select s.id into _store_id
    from public.stores s
   where s.slug=public.storefront_normalize_slug(_slug) and s.status='ativa'
   limit 1;
  if _store_id is null then return jsonb_build_object('products','[]'::jsonb); end if;

  return jsonb_build_object(
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id',p.id,
        'category_ids',to_jsonb(array[p.category_id] || coalesce((
          select array_agg(pcp.category_id order by pcp.sort_order,pcp.category_id)
            from public.product_category_placements pcp
            join public.categories c on c.id=pcp.category_id and c.store_id=pcp.store_id
           where pcp.store_id=_store_id and pcp.product_id=p.id
             and c.is_active and not c.is_archived
        ),'{}'::uuid[])),
        'search_aliases',to_jsonb(p.search_aliases),
        'promotion',private.best_catalog_promotion(
          _store_id,
          p.id,
          greatest(0,coalesce((
            select min(v.price)
              from public.product_variants v
             where v.store_id=_store_id and v.product_id=p.id
               and v.is_available and not v.is_archived
          ),p.base_price)),
          case when p.sale_mode::text='measured' then greatest(coalesce(p.minimum_quantity,1),0.000001) else 1 end,
          now()
        )
      ) order by p.sort_order,p.name,p.id)
        from public.products p
       where p.store_id=_store_id
         and private.product_runtime_available(_store_id,p.id,now())
    ),'[]'::jsonb)
  );
end;
$function$;

revoke all on function public.storefront_catalog_enrichment(text) from public, anon, authenticated;
grant execute on function public.storefront_catalog_enrichment(text) to service_role;
