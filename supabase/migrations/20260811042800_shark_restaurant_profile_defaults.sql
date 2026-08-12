-- SHARK — refinamento dos defaults de Marmitaria / Restaurante.
-- A categoria continua sendo apenas uma sugestão inicial; a regra final pertence ao produto.

update public.category_profiles
set
  default_capabilities = default_capabilities || '{"beverages":true,"add_ons":true}'::jsonb,
  product_templates = '[
    {
      "type":"buildable",
      "label":"Marmita montável",
      "capabilities":{
        "sizes":true,
        "proteins":true,
        "sides":true,
        "add_ons":true,
        "removals":true,
        "beverages":true
      }
    },
    {"type":"simple","label":"Prato do dia","capabilities":{}},
    {"type":"combo","label":"Combo refeição","capabilities":{"combo_steps":true,"beverages":true}}
  ]'::jsonb,
  updated_at = now()
where code='restaurante';

-- O starter antigo só gerava bebida quando o produto era combo. Esta função
-- complementar cria uma etapa opcional de bebida para qualquer produto montável
-- que declare a capability beverages. É idempotente e nasce como rascunho.
create or replace function public.ensure_buildable_beverage_draft(
  _store_id uuid,
  _product_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _p public.products;
  _gid uuid;
  _link uuid;
begin
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);

  select * into _p
  from public.products
  where id=_product_id and store_id=_sid and not is_archived
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if not coalesce((_p.capabilities->>'beverages')::boolean,false)
     or _p.product_type='combo' then
    return jsonb_build_object('created',false);
  end if;

  select og.id into _gid
  from public.product_option_groups pog
  join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
  where pog.store_id=_sid and pog.product_id=_product_id and not pog.is_archived
    and og.role='beverage' and not og.is_archived
  limit 1;

  if _gid is not null then
    return jsonb_build_object('created',false,'group_id',_gid);
  end if;

  insert into public.option_groups(
    store_id,name,description,selection_type,is_required,min_selections,max_selections,
    allow_quantity,pricing_strategy,price_effect,role,included_selections,
    configuration,is_active,sort_order
  ) values(
    _sid,'Bebida','Rascunho sugerido pelo Shark. Cadastre as bebidas ou remova esta etapa se não precisar.',
    'unica',false,0,1,false,'sum','additive','beverage',0,
    jsonb_build_object('shark_starter_key','beverage','shark_draft',true,'generated_at',now()),
    false,coalesce((select max(sort_order)+1 from public.option_groups where store_id=_sid),0)
  ) returning id into _gid;

  insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,sort_order)
  values(
    _sid,_product_id,_gid,true,
    coalesce((select max(sort_order)+1 from public.product_option_groups where store_id=_sid and product_id=_product_id),0)
  ) returning id into _link;

  perform private.log_config_audit(_sid,'catalog.product.beverage_draft.generated','products',_product_id,array['capabilities','option_groups']);
  return jsonb_build_object('created',true,'group_id',_gid,'link_id',_link);
end;
$$;

grant execute on function public.ensure_buildable_beverage_draft(uuid,uuid) to authenticated;
revoke all on function public.ensure_buildable_beverage_draft(uuid,uuid) from anon;
