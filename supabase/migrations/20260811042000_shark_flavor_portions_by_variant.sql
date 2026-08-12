-- SHARK — porções de sabor por tamanho/variação.
-- max_flavors = quantos sabores distintos podem ser usados.
-- flavor_parts = em quantas partes físicas o produto é dividido.

alter table public.product_variants
  add column if not exists flavor_parts integer;

alter table public.product_variants
  drop constraint if exists product_variants_flavor_parts_check;
alter table public.product_variants
  add constraint product_variants_flavor_parts_check
  check (flavor_parts is null or flavor_parts between 1 and 20);

-- Compatibilidade: tamanhos multi-sabor já configurados começam com o mesmo
-- número de partes do limite antigo. O lojista pode separar as duas regras depois.
update public.product_variants
set flavor_parts=max_flavors
where flavor_parts is null and max_flavors is not null;

create or replace function private.catalog_variant_json(_v public.product_variants)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',_v.id,'product_id',_v.product_id,'name',_v.name,'price',_v.price,
    'is_default',_v.is_default,'is_active',_v.is_available,'is_archived',_v.is_archived,
    'sort_order',_v.sort_order,'package_quantity',_v.package_quantity,
    'package_unit',_v.package_unit,'max_flavors',_v.max_flavors,
    'flavor_parts',_v.flavor_parts,'updated_at',_v.updated_at)
$$;

create or replace function private.sync_product_flavor_group_capacity(_sid uuid,_product_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _max_parts integer;
begin
  select max(coalesce(v.flavor_parts,v.max_flavors,1)) into _max_parts
  from public.product_variants v
  where v.store_id=_sid and v.product_id=_product_id
    and v.is_available and not v.is_archived;

  if _max_parts is null then return; end if;

  update public.option_groups og
     set selection_type='quantidade',
         allow_quantity=true,
         max_selections=greatest(1,_max_parts),
         portion_count=null,
         updated_at=now()
  from public.product_option_groups pog
  where pog.store_id=_sid and pog.product_id=_product_id
    and pog.option_group_id=og.id and og.store_id=_sid
    and pog.is_active and not pog.is_archived
    and not og.is_archived and og.role='flavor';
end;
$$;

create or replace function public.update_variant_flavor_structure(
  _store_id uuid,
  _id uuid,
  _max_flavors integer,
  _flavor_parts integer,
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
  if _flavor_parts is not null and (_flavor_parts<1 or _flavor_parts>20) then
    raise exception 'INVALID_FLAVOR_PARTS';
  end if;
  if _max_flavors is not null and _flavor_parts is not null and _max_flavors>_flavor_parts then
    raise exception 'MAX_FLAVORS_ABOVE_PARTS';
  end if;

  update public.product_variants
     set max_flavors=_max_flavors,
         flavor_parts=_flavor_parts,
         updated_at=now()
   where id=_id and store_id=_sid
   returning * into _row;

  perform private.sync_product_flavor_group_capacity(_sid,_row.product_id);
  perform private.log_config_audit(_sid,'catalog.variant.flavor_structure.updated','product_variants',_id,array['max_flavors','flavor_parts']);
  return private.catalog_variant_json(_row);
end;
$$;

grant execute on function public.update_variant_flavor_structure(uuid,uuid,integer,integer,timestamptz) to authenticated;
revoke all on function public.update_variant_flavor_structure(uuid,uuid,integer,integer,timestamptz) from anon;

-- Mantém a RPC anterior compatível e passa a preservar/derivar flavor_parts.
create or replace function public.update_variant_flavor_limit(
  _store_id uuid,_id uuid,_max_flavors integer,_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id); _row public.product_variants;
begin
  select * into _row from public.product_variants where id=_id and store_id=_sid;
  if not found then raise exception 'NOT_FOUND'; end if;
  return public.update_variant_flavor_structure(
    _sid,_id,_max_flavors,coalesce(_row.flavor_parts,_max_flavors),_expected_updated_at
  );
end;
$$;

-- Projeção pública com as duas regras.
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
      'package_quantity',v.package_quantity,'package_unit',v.package_unit,
      'max_flavors',v.max_flavors,'flavor_parts',v.flavor_parts
    ) order by v.sort_order,v.name) from public.product_variants v where v.product_id=p.id and v.store_id=v_store and v.is_available and not v.is_archived),'[]'::jsonb),
    'option_groups',coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'link_id',pog.id,'name',g.name,'description',g.description,'role',g.role,'selection_type',g.selection_type,
      'is_required',coalesce(pog.is_required,g.is_required),'min_selections',coalesce(pog.min_selections,g.min_selections),'max_selections',coalesce(pog.max_selections,g.max_selections),
      'included_selections',g.included_selections,'allow_quantity',g.allow_quantity,'pricing_strategy',g.pricing_strategy,'price_effect',g.price_effect,'portion_count',g.portion_count,'configuration',g.configuration,'sort_order',pog.sort_order,
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'name',i.name,'description',i.description,'additional_price',coalesce(vp.price,i.additional_price),'max_quantity',greatest(i.max_quantity,20),
        'linked_product_id',i.linked_product_id,'linked_variant_id',i.linked_variant_id,'metadata',i.metadata
      ) order by i.sort_order,i.name) from public.option_items i left join public.product_variant_option_item_prices vp on vp.option_item_id=i.id and vp.product_id=p.id and vp.product_variant_id=(select dv.id from public.product_variants dv where dv.product_id=p.id and dv.is_default and dv.is_available limit 1) where i.option_group_id=g.id and i.store_id=v_store and i.is_available and not i.is_archived),'[]'::jsonb)
    ) order by pog.sort_order,g.name) from public.product_option_groups pog join public.option_groups g on g.id=pog.option_group_id and g.store_id=v_store where pog.product_id=p.id and pog.store_id=v_store and pog.is_active and not pog.is_archived and g.is_active and not g.is_archived),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.storefront_product(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_product(text,uuid) to service_role;

-- Regra adicional canônica sobre o resultado do v2. O grupo de sabor usa
-- selection_type=quantidade para representar porções repetidas do mesmo sabor.
create or replace function private.calculate_configured_product_price(
  _store_id uuid,_product_id uuid,_variant_id uuid,_quantity numeric,_selections jsonb default '[]'::jsonb
) returns jsonb
language plpgsql stable set search_path=public,private,pg_temp as $$
declare
  _normalized jsonb;
  _result jsonb;
  _max_flavors integer;
  _parts integer;
  _flavor_group uuid;
  _distinct integer:=0;
  _selected_parts integer:=0;
  _entry jsonb;
  _errors jsonb;
begin
  _normalized:=private.normalize_configured_selections(_store_id,_selections);
  _result:=private.calculate_configured_product_price_v2(_store_id,_product_id,_variant_id,_quantity,_normalized);
  if _variant_id is null then return _result; end if;

  select max_flavors,flavor_parts into _max_flavors,_parts
  from public.product_variants
  where id=_variant_id and product_id=_product_id and store_id=_store_id
    and is_available and not is_archived;
  if _max_flavors is null and _parts is null then return _result; end if;

  select og.id into _flavor_group
  from public.product_option_groups pog
  join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
  where pog.store_id=_store_id and pog.product_id=_product_id
    and pog.is_active and not pog.is_archived and og.is_active and not og.is_archived
    and og.role='flavor'
  order by pog.sort_order,og.sort_order limit 1;
  if _flavor_group is null then return _result; end if;

  for _entry in select value from jsonb_array_elements(_normalized) t(value) loop
    if nullif(_entry->>'group_id','')::uuid=_flavor_group then
      select count(*),coalesce(sum(coalesce(nullif(item->>'quantity','')::integer,1)),0)::integer
      into _distinct,_selected_parts
      from jsonb_array_elements(coalesce(_entry->'items','[]'::jsonb)) item;
      exit;
    end if;
  end loop;

  _errors:=coalesce(_result->'validation_errors','[]'::jsonb);
  if jsonb_typeof(_errors)<>'array' then _errors:='[]'::jsonb; end if;

  if _max_flavors is not null and _distinct>_max_flavors then
    _errors:=_errors||jsonb_build_array('VARIANT_FLAVOR_LIMIT_EXCEEDED');
  end if;
  if _parts is not null and _selected_parts<>_parts then
    _errors:=_errors||jsonb_build_array('VARIANT_FLAVOR_PARTS_INCOMPLETE');
  end if;

  if jsonb_array_length(_errors)>0 then
    _result:=jsonb_set(_result,'{validation_errors}',_errors,true);
    _result:=jsonb_set(_result,'{final_total}','null'::jsonb,true);
  end if;
  return _result;
end;
$$;
