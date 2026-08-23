create or replace function public.list_catalog_product_category_placements(_store_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
begin
  perform private.require_permission('catalog.view',_sid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'product_id',p.id,
      'primary_category_id',p.category_id,
      'additional_category_ids',to_jsonb(coalesce((
        select array_agg(pcp.category_id order by pcp.sort_order,pcp.category_id)
          from public.product_category_placements pcp
          join public.categories c on c.id=pcp.category_id and c.store_id=pcp.store_id
         where pcp.store_id=_sid and pcp.product_id=p.id
           and c.is_active and not c.is_archived
      ),'{}'::uuid[])),
      'category_ids',to_jsonb(array[p.category_id] || coalesce((
        select array_agg(pcp.category_id order by pcp.sort_order,pcp.category_id)
          from public.product_category_placements pcp
          join public.categories c on c.id=pcp.category_id and c.store_id=pcp.store_id
         where pcp.store_id=_sid and pcp.product_id=p.id
           and c.is_active and not c.is_archived
      ),'{}'::uuid[]))
    ) order by p.sort_order,p.name,p.id)
      from public.products p
     where p.store_id=_sid and not p.is_archived
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.list_catalog_product_category_placements(uuid) from public, anon;
grant execute on function public.list_catalog_product_category_placements(uuid) to authenticated, service_role;

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
