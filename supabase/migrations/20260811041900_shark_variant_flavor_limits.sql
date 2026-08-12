-- SHARK — limite de sabores por tamanho/variação.
-- A regra pertence à variação do produto, não à categoria da loja.

alter table public.product_variants
  add column if not exists max_flavors integer;

alter table public.product_variants
  drop constraint if exists product_variants_max_flavors_check;
alter table public.product_variants
  add constraint product_variants_max_flavors_check
  check (max_flavors is null or max_flavors between 1 and 20);

create or replace function private.catalog_variant_json(_v public.product_variants)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',_v.id,'product_id',_v.product_id,'name',_v.name,'price',_v.price,
    'is_default',_v.is_default,'is_active',_v.is_available,'is_archived',_v.is_archived,
    'sort_order',_v.sort_order,'package_quantity',_v.package_quantity,
    'package_unit',_v.package_unit,'max_flavors',_v.max_flavors,'updated_at',_v.updated_at)
$$;

create or replace function public.update_variant_flavor_limit(
  _store_id uuid,
  _id uuid,
  _max_flavors integer,
  _expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _row public.product_variants;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.product_variants
   where id=_id and store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if _row.is_archived then raise exception 'VARIANT_ARCHIVED'; end if;
  perform private.assert_version(_expected_updated_at,_row.updated_at);
  if _max_flavors is not null and (_max_flavors<1 or _max_flavors>20) then
    raise exception 'INVALID_MAX_FLAVORS';
  end if;

  update public.product_variants
     set max_flavors=_max_flavors, updated_at=now()
   where id=_id and store_id=_sid
   returning * into _row;

  perform private.log_config_audit(_sid,'catalog.variant.flavor_limit.updated','product_variants',_id,array['max_flavors']);
  return private.catalog_variant_json(_row);
end;
$$;

grant execute on function public.update_variant_flavor_limit(uuid,uuid,integer,timestamptz) to authenticated;
revoke all on function public.update_variant_flavor_limit(uuid,uuid,integer,timestamptz) from anon;

-- Projeção pública com o limite necessário para a UX do configurador.
create or replace function public.storefront_product(_slug text,_product_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_slug text:=public.storefront_normalize_slug(_slug); v_store uuid; p public.products;
begin
  if v_slug is null or _product_id is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;
  select * into p from public.products pr where pr.id=_product_id and pr.store_id=v_store and pr.is_available and not pr.is_archived limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'product',jsonb_build_object(
      'id',p.id,'category_id',p.category_id,'name',p.name,'description',p.description,'image_path',p.image_path,'base_price',p.base_price,
      'sale_mode',p.sale_mode,'measurement_unit',p.measurement_unit,'pricing_unit',p.pricing_unit,'unit_label',p.unit_label,'has_variants',p.has_variants,
      'product_type',p.product_type,'capabilities',p.capabilities,'engine_version',p.engine_version,'pricing_rules',p.pricing_rules,
      'is_sold_out',p.is_sold_out,'stock_quantity',p.stock_quantity,'minimum_quantity',p.minimum_quantity,'quantity_step',p.quantity_step,'max_quantity',p.max_quantity,'allows_notes',p.allows_notes
    ),
    'variants',coalesce((select jsonb_agg(jsonb_build_object(
      'id',v.id,'name',v.name,'price',v.price,'is_default',v.is_default,
      'package_quantity',v.package_quantity,'package_unit',v.package_unit,'max_flavors',v.max_flavors
    ) order by v.sort_order,v.name) from public.product_variants v where v.product_id=p.id and v.store_id=v_store and v.is_available and not v.is_archived),'[]'::jsonb),
    'option_groups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'link_id',pog.id,'name',g.name,'description',g.description,'role',g.role,'selection_type',g.selection_type,
      'is_required',coalesce(pog.is_required,g.is_required),'min_selections',coalesce(pog.min_selections,g.min_selections),'max_selections',coalesce(pog.max_selections,g.max_selections),
      'included_selections',g.included_selections,'allow_quantity',g.allow_quantity,'pricing_strategy',g.pricing_strategy,'price_effect',g.price_effect,'portion_count',g.portion_count,'configuration',g.configuration,'sort_order',pog.sort_order,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'name',i.name,'description',i.description,'additional_price',coalesce(vp.price,i.additional_price),'max_quantity',i.max_quantity,
        'linked_product_id',i.linked_product_id,'linked_variant_id',i.linked_variant_id,'metadata',i.metadata
      ) order by i.sort_order,i.name) from public.option_items i left join public.product_variant_option_item_prices vp on vp.option_item_id=i.id and vp.product_id=p.id and vp.product_variant_id=(select dv.id from public.product_variants dv where dv.product_id=p.id and dv.is_default and dv.is_available limit 1) where i.option_group_id=g.id and i.store_id=v_store and i.is_available and not i.is_archived),'[]'::jsonb)
    ) order by pog.sort_order,g.name) from public.product_option_groups pog join public.option_groups g on g.id=pog.option_group_id and g.store_id=v_store where pog.product_id=p.id and pog.store_id=v_store and pog.is_active and not pog.is_archived and g.is_active and not g.is_archived),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.storefront_product(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_product(text,uuid) to service_role;

-- Regra canônica: o limite por tamanho é validado no mesmo caminho usado por
-- prévia, storefront, carrinho e checkout. O frontend é apenas uma ajuda visual.
create or replace function private.calculate_configured_product_price(
  _store_id uuid,_product_id uuid,_variant_id uuid,_quantity numeric,_selections jsonb default '[]'::jsonb
) returns jsonb
language plpgsql stable set search_path=public,private,pg_temp as $$
declare
  _normalized jsonb;
  _result jsonb;
  _limit integer;
  _flavor_group uuid;
  _chosen integer:=0;
  _entry jsonb;
  _errors jsonb;
begin
  _normalized:=private.normalize_configured_selections(_store_id,_selections);
  _result:=private.calculate_configured_product_price_v2(_store_id,_product_id,_variant_id,_quantity,_normalized);

  if _variant_id is null then return _result; end if;
  select max_flavors into _limit from public.product_variants
   where id=_variant_id and product_id=_product_id and store_id=_store_id
     and is_available and not is_archived;
  if _limit is null then return _result; end if;

  select og.id into _flavor_group
  from public.product_option_groups pog
  join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
  where pog.store_id=_store_id and pog.product_id=_product_id
    and pog.is_active and not pog.is_archived and og.is_active and not og.is_archived
    and og.role='flavor'
  order by pog.sort_order,og.sort_order
  limit 1;

  if _flavor_group is null then return _result; end if;
  for _entry in select value from jsonb_array_elements(_normalized) t(value) loop
    if nullif(_entry->>'group_id','')::uuid=_flavor_group then
      select coalesce(sum(coalesce(nullif(item->>'quantity','')::integer,1)),0)::integer into _chosen
      from jsonb_array_elements(coalesce(_entry->'items','[]'::jsonb)) item;
      exit;
    end if;
  end loop;

  if _chosen>_limit then
    _errors:=coalesce(_result->'validation_errors','[]'::jsonb);
    if jsonb_typeof(_errors)<>'array' then _errors:='[]'::jsonb; end if;
    _result:=jsonb_set(_result,'{validation_errors}',_errors||jsonb_build_array('VARIANT_FLAVOR_LIMIT_EXCEEDED'),true);
    _result:=jsonb_set(_result,'{final_total}','null'::jsonb,true);
  end if;
  return _result;
end;
$$;
