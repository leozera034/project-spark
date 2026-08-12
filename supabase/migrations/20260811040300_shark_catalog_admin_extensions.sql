-- SHARK — extensões administrativas do catálogo avançado.

create or replace function private.catalog_product_json(_p public.products)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',_p.id,'category_id',_p.category_id,
    'category_name',(select c.name from public.categories c where c.id=_p.category_id and c.store_id=_p.store_id),
    'name',_p.name,'description',_p.description,'image_path',_p.image_path,'base_price',_p.base_price,
    'pricing_unit',_p.pricing_unit,'minimum_quantity',_p.minimum_quantity,'quantity_step',_p.quantity_step,'allows_notes',_p.allows_notes,
    'is_active',_p.is_available,'is_featured',_p.is_featured,'is_sold_out',_p.is_sold_out,'is_archived',_p.is_archived,'has_variants',_p.has_variants,
    'product_type',_p.product_type,'capabilities',_p.capabilities,'pricing_rules',_p.pricing_rules,'engine_version',_p.engine_version,'stock_quantity',_p.stock_quantity,
    'sort_order',_p.sort_order,'updated_at',_p.updated_at)
$$;

create or replace function private.catalog_option_item_json(_i public.option_items)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',_i.id,'option_group_id',_i.option_group_id,'name',_i.name,'description',_i.description,'additional_price',_i.additional_price,
    'max_quantity',_i.max_quantity,'is_active',_i.is_available,'is_archived',_i.is_archived,'sort_order',_i.sort_order,'updated_at',_i.updated_at,
    'linked_product_id',_i.linked_product_id,'linked_variant_id',_i.linked_variant_id,'inventory_quantity',_i.inventory_quantity,'metadata',_i.metadata)
$$;

create or replace function private.catalog_option_group_json(_g public.option_groups)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',_g.id,'name',_g.name,'description',_g.description,'role',_g.role,'selection_type',_g.selection_type,'is_required',_g.is_required,
    'min_selections',_g.min_selections,'max_selections',_g.max_selections,'included_selections',_g.included_selections,
    'pricing_strategy',_g.pricing_strategy,'price_effect',_g.price_effect,'portion_count',_g.portion_count,'configuration',_g.configuration,
    'is_active',_g.is_active,'is_archived',_g.is_archived,'sort_order',_g.sort_order,'updated_at',_g.updated_at,
    'linked_product_count',(select count(*) from public.product_option_groups pog where pog.option_group_id=_g.id and pog.store_id=_g.store_id and not pog.is_archived),
    'items',coalesce((select jsonb_agg(private.catalog_option_item_json(i) order by i.is_archived,i.sort_order,i.name,i.id) from public.option_items i where i.option_group_id=_g.id and i.store_id=_g.store_id),'[]'::jsonb))
$$;

create or replace function public.update_option_group_engine(
  _store_id uuid,_id uuid,_role text,_included_selections integer,_configuration jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id); _row public.option_groups;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.option_groups where id=_id and store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if _row.is_archived then raise exception 'GROUP_ARCHIVED'; end if;
  if nullif(trim(_role),'') is null or length(_role)>50 then raise exception 'INVALID_GROUP_ROLE'; end if;
  if coalesce(_included_selections,0)<0 or coalesce(_included_selections,0)>_row.max_selections then raise exception 'INVALID_INCLUDED_SELECTIONS'; end if;
  if jsonb_typeof(coalesce(_configuration,'{}'))<>'object' then raise exception 'INVALID_GROUP_CONFIGURATION'; end if;
  update public.option_groups set role=lower(trim(_role)),included_selections=coalesce(_included_selections,0),configuration=coalesce(_configuration,'{}'),updated_at=now()
   where id=_id and store_id=_sid returning * into _row;
  perform private.log_config_audit(_sid,'catalog.option_group.engine.updated','option_groups',_id,array['role','included_selections','configuration']);
  return private.catalog_option_group_json(_row);
end; $$;

create or replace function public.update_option_item_engine(
  _store_id uuid,_id uuid,_linked_product_id uuid,_linked_variant_id uuid,_inventory_quantity numeric,_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id); _row public.option_items;
begin
  perform private.require_permission('catalog.update',_sid);
  select * into _row from public.option_items where id=_id and store_id=_sid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if _row.is_archived then raise exception 'ITEM_ARCHIVED'; end if;
  if _inventory_quantity is not null and _inventory_quantity<0 then raise exception 'INVALID_STOCK'; end if;
  if _linked_product_id is not null and not exists(select 1 from public.products p where p.id=_linked_product_id and p.store_id=_sid and not p.is_archived) then raise exception 'LINKED_PRODUCT_INVALID'; end if;
  if _linked_variant_id is not null and not exists(select 1 from public.product_variants v where v.id=_linked_variant_id and v.store_id=_sid and v.product_id=_linked_product_id and not v.is_archived) then raise exception 'LINKED_VARIANT_INVALID'; end if;
  if jsonb_typeof(coalesce(_metadata,'{}'))<>'object' then raise exception 'INVALID_ITEM_METADATA'; end if;
  update public.option_items set linked_product_id=_linked_product_id,linked_variant_id=_linked_variant_id,inventory_quantity=_inventory_quantity,metadata=coalesce(_metadata,'{}'),updated_at=now()
   where id=_id and store_id=_sid returning * into _row;
  perform private.log_config_audit(_sid,'catalog.option_item.engine.updated','option_items',_id,array['linked_product_id','linked_variant_id','inventory_quantity','metadata']);
  return private.catalog_option_item_json(_row);
end; $$;

-- Templates rápidos criam grupos genéricos sem acoplar o frontend à categoria.
create or replace function public.create_product_option_group_from_template(
  _store_id uuid,_product_id uuid,_name text,_role text,_required boolean,_min integer,_max integer,_included integer,_selection_type text default 'multipla',_portion_count integer default null,_configuration jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare _sid uuid:=private.resolve_store(_store_id); _gid uuid; _link uuid; _sel public.option_selection_type;
begin
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);
  if _selection_type not in ('unica','multipla','quantidade') then raise exception 'INVALID_SELECTION_TYPE'; end if;
  _sel:=_selection_type::public.option_selection_type;
  if _min<0 or _max<1 or _min>_max or _included<0 or _included>_max then raise exception 'INVALID_SELECTION_LIMITS'; end if;
  if _required and _min<1 then _min:=1; end if;
  insert into public.option_groups(store_id,name,description,selection_type,is_required,min_selections,max_selections,allow_quantity,pricing_strategy,price_effect,portion_count,role,included_selections,configuration,is_active,sort_order)
  values(_sid,private.clean_text(_name),null,_sel,coalesce(_required,false),_min,_max,_sel='quantidade','sum','additive',_portion_count,coalesce(nullif(lower(trim(_role)),''),'generic'),_included,coalesce(_configuration,'{}'),true,coalesce((select max(sort_order)+1 from public.option_groups where store_id=_sid),0)) returning id into _gid;
  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,sort_order)
  values(_sid,_product_id,_gid,true,coalesce((select max(sort_order)+1 from public.product_option_groups where store_id=_sid and product_id=_product_id),0)) returning id into _link;
  return jsonb_build_object('group_id',_gid,'link_id',_link);
end; $$;

grant execute on function public.update_option_group_engine(uuid,uuid,text,integer,jsonb) to authenticated;
grant execute on function public.update_option_item_engine(uuid,uuid,uuid,uuid,numeric,jsonb) to authenticated;
grant execute on function public.create_product_option_group_from_template(uuid,uuid,text,text,boolean,integer,integer,integer,text,integer,jsonb) to authenticated;
revoke all on function public.update_option_group_engine(uuid,uuid,text,integer,jsonb) from anon;
revoke all on function public.update_option_item_engine(uuid,uuid,uuid,uuid,numeric,jsonb) from anon;
revoke all on function public.create_product_option_group_from_template(uuid,uuid,text,text,boolean,integer,integer,integer,text,integer,jsonb) from anon;
