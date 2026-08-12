-- SHARK — defaults seguros para produtos de refeição montável.
-- Atua somente em rascunhos gerados pelo Shark e somente quando o produto
-- declara as capacidades proteins + sides. Nunca sobrescreve grupos já publicados.

create or replace function public.apply_meal_group_defaults(
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
  _changed integer:=0;
begin
  perform private.require_permission('catalog.update',_sid);
  perform private.assert_product_editable(_sid,_product_id);

  select * into _p
  from public.products
  where id=_product_id and store_id=_sid and not is_archived
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if not coalesce((_p.capabilities->>'proteins')::boolean,false)
     or not coalesce((_p.capabilities->>'sides')::boolean,false) then
    return jsonb_build_object('applied',false,'changed',0);
  end if;

  update public.option_groups og
  set
    is_required = case when og.role in ('protein','side') then true else false end,
    min_selections = case
      when og.role='protein' then 1
      when og.role='side' then 1
      else 0
    end,
    max_selections = case
      when og.role='protein' then 1
      when og.role='side' then greatest(1,least(og.max_selections,4))
      when og.role='beverage' then 1
      else og.max_selections
    end,
    included_selections = case
      when og.role='side' then greatest(0,least(og.max_selections,4))
      else og.included_selections
    end,
    configuration = og.configuration || jsonb_build_object('meal_builder',true),
    updated_at=now()
  from public.product_option_groups pog
  where pog.store_id=_sid and pog.product_id=_product_id
    and pog.option_group_id=og.id and og.store_id=_sid
    and not pog.is_archived and not og.is_archived
    and coalesce((og.configuration->>'shark_draft')::boolean,false)
    and og.role in ('protein','side','addon','removal','beverage');

  get diagnostics _changed = row_count;

  perform private.log_config_audit(_sid,'catalog.product.meal_defaults.applied','products',_product_id,array['option_groups']);
  return jsonb_build_object('applied',true,'changed',_changed);
end;
$$;

grant execute on function public.apply_meal_group_defaults(uuid,uuid) to authenticated;
revoke all on function public.apply_meal_group_defaults(uuid,uuid) from anon;
