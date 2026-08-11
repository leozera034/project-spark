-- SHARK — projeção pública segura do motor v2.
-- Só expõe regras necessárias para renderizar o configurador; nenhuma configuração administrativa sensível.

create or replace function public.storefront_catalog(_slug text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_slug text:=public.storefront_normalize_slug(_slug); v_store uuid;
begin
  if v_slug is null then return null; end if;
  select st.id into v_store from public.stores st where st.slug=v_slug and st.status='ativa' limit 1;
  if v_store is null then return null; end if;
  return jsonb_build_object(
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'image_path',c.image_path,'sort_order',c.sort_order) order by c.sort_order,c.name) from public.categories c where c.store_id=v_store and c.is_active and not c.is_archived and exists(select 1 from public.products p where p.store_id=v_store and p.category_id=c.id and p.is_available and not p.is_archived)),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'category_id',p.category_id,'name',p.name,'description',p.description,'image_path',p.image_path,
      'base_price',p.base_price,'from_price',case when p.has_variants then (select min(v.price) from public.product_variants v where v.product_id=p.id and v.is_available and not v.is_archived) else p.base_price end,
      'sale_mode',p.sale_mode,'measurement_unit',p.measurement_unit,'pricing_unit',p.pricing_unit,'unit_label',p.unit_label,'has_variants',p.has_variants,
      'product_type',p.product_type,'capabilities',p.capabilities,'engine_version',p.engine_version,
      'is_sold_out',p.is_sold_out,'is_featured',p.is_featured,'minimum_quantity',p.minimum_quantity,'quantity_step',p.quantity_step,'max_quantity',p.max_quantity,'stock_quantity',p.stock_quantity,'allows_notes',p.allows_notes,
      'has_options',exists(select 1 from public.product_option_groups pog where pog.product_id=p.id and pog.is_active and not pog.is_archived),'sort_order',p.sort_order
    ) order by p.sort_order,p.name) from public.products p where p.store_id=v_store and p.is_available and not p.is_archived),'[]'::jsonb)
  );
end; $$;

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
    'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'price',v.price,'is_default',v.is_default,'package_quantity',v.package_quantity,'package_unit',v.package_unit) order by v.sort_order,v.name) from public.product_variants v where v.product_id=p.id and v.store_id=v_store and v.is_available and not v.is_archived),'[]'::jsonb),
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
end; $$;

revoke all on function public.storefront_catalog(text) from public,anon,authenticated;
revoke all on function public.storefront_product(text,uuid) from public,anon,authenticated;
grant execute on function public.storefront_catalog(text) to service_role;
grant execute on function public.storefront_product(text,uuid) to service_role;
