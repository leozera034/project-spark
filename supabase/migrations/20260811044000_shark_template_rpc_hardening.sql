-- SHARK — hardening final da criação de grupos a partir de templates.
-- Mantém a assinatura pública existente e fecha entradas que a UI normalmente evita,
-- mas que poderiam ser enviadas por chamada direta à RPC.

create or replace function public.create_product_option_group_from_template(
  _store_id uuid,
  _product_id uuid,
  _name text,
  _role text,
  _required boolean,
  _min integer,
  _max integer,
  _included integer,
  _selection_type text default 'multipla',
  _portion_count integer default null,
  _configuration jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _gid uuid;
  _link uuid;
  _sel public.option_selection_type;
  _name_clean text:=private.clean_text(_name);
  _role_clean text:=lower(trim(coalesce(_role,'generic')));
begin
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);
  perform private.assert_meaningful_name(_name_clean,1,100,'INVALID_GROUP_NAME');

  if _selection_type not in ('unica','multipla','quantidade') then
    raise exception 'INVALID_SELECTION_TYPE';
  end if;
  _sel:=_selection_type::public.option_selection_type;

  if _min is null or _max is null or _included is null
     or _min<0 or _max<1 or _min>_max or _included<0 or _included>_max then
    raise exception 'INVALID_SELECTION_LIMITS';
  end if;

  if coalesce(_required,false) and _min<1 then
    _min:=1;
  end if;

  if nullif(_role_clean,'') is null or length(_role_clean)>50 then
    raise exception 'INVALID_GROUP_ROLE';
  end if;

  if _portion_count is not null and _portion_count<1 then
    raise exception 'INVALID_PORTION_COUNT';
  end if;

  if jsonb_typeof(coalesce(_configuration,'{}'::jsonb))<>'object' then
    raise exception 'INVALID_GROUP_CONFIGURATION';
  end if;

  insert into public.option_groups(
    store_id,name,description,selection_type,is_required,min_selections,max_selections,
    allow_quantity,pricing_strategy,price_effect,portion_count,role,included_selections,
    configuration,is_active,sort_order
  ) values(
    _sid,_name_clean,null,_sel,coalesce(_required,false),_min,_max,
    _sel='quantidade','sum','additive',_portion_count,_role_clean,_included,
    coalesce(_configuration,'{}'::jsonb),true,
    coalesce((select max(sort_order)+1 from public.option_groups where store_id=_sid),0)
  ) returning id into _gid;

  insert into public.product_option_groups(
    store_id,product_id,option_group_id,is_active,sort_order
  ) values(
    _sid,_product_id,_gid,true,
    coalesce((select max(sort_order)+1 from public.product_option_groups where store_id=_sid and product_id=_product_id),0)
  ) returning id into _link;

  perform private.log_config_audit(
    _sid,
    'catalog.option_group.template.created',
    'option_groups',
    _gid,
    array['name','role','selection_type','min_selections','max_selections','included_selections','portion_count','configuration']
  );

  return jsonb_build_object('group_id',_gid,'link_id',_link);
end;
$$;

grant execute on function public.create_product_option_group_from_template(uuid,uuid,text,text,boolean,integer,integer,integer,text,integer,jsonb) to authenticated;
revoke all on function public.create_product_option_group_from_template(uuid,uuid,text,text,boolean,integer,integer,integer,text,integer,jsonb) from anon;
