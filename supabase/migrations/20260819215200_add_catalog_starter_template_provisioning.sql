create or replace function public.apply_catalog_starter_template(_store_id uuid, _profile_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  _sid uuid := private.resolve_store(_store_id);
  _profile public.category_profiles;
  _category_names text[];
  _group_specs jsonb := '[]'::jsonb;
  _name text;
  _spec jsonb;
  _created_categories int := 0;
  _created_groups int := 0;
begin
  perform private.require_permission('catalog.create', _sid);

  select * into _profile
  from public.category_profiles
  where code = lower(trim(_profile_code)) and is_active
  limit 1;

  if not found then
    raise exception 'CATEGORY_PROFILE_NOT_FOUND' using errcode='P0001';
  end if;

  update public.stores
     set category_profile_id = _profile.id,
         segment = coalesce(nullif(trim(segment),''), _profile.name),
         updated_at = now()
   where id = _sid;

  case _profile.code
    when 'pizzaria' then
      _category_names := array['Pizzas','Combos','Bebidas','Sobremesas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Sabores da pizza','selection_type','multipla','role','flavor','min',1,'max',2),
        jsonb_build_object('name','Borda','selection_type','unica','role','crust','min',0,'max',1),
        jsonb_build_object('name','Massa','selection_type','unica','role','dough','min',0,'max',1),
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20)
      );
    when 'hamburgueria' then
      _category_names := array['Hambúrgueres','Combos','Porções','Bebidas','Sobremesas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20),
        jsonb_build_object('name','Molhos','selection_type','multipla','role','sauce','min',0,'max',6),
        jsonb_build_object('name','Ponto da carne','selection_type','unica','role','doneness','min',0,'max',1),
        jsonb_build_object('name','Pão','selection_type','unica','role','bread','min',0,'max',1)
      );
    when 'acai' then
      _category_names := array['Açaí','Combos','Bebidas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Tamanho','selection_type','unica','role','size','min',1,'max',1),
        jsonb_build_object('name','Frutas','selection_type','multipla','role','fruit','min',0,'max',8),
        jsonb_build_object('name','Cremes','selection_type','multipla','role','cream','min',0,'max',5),
        jsonb_build_object('name','Coberturas','selection_type','multipla','role','topping','min',0,'max',8),
        jsonb_build_object('name','Complementos','selection_type','quantidade','role','generic','min',0,'max',20)
      );
    when 'sorveteria' then
      _category_names := array['Sorvetes','Picolés','Açaí','Bebidas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Sabores','selection_type','multipla','role','flavor','min',1,'max',6),
        jsonb_build_object('name','Recipiente','selection_type','unica','role','container','min',1,'max',1),
        jsonb_build_object('name','Coberturas','selection_type','multipla','role','topping','min',0,'max',8),
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20)
      );
    when 'restaurante' then
      _category_names := array['Pratos','Marmitas','Combos','Porções','Bebidas','Sobremesas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Tamanho','selection_type','unica','role','size','min',0,'max',1),
        jsonb_build_object('name','Proteína','selection_type','unica','role','protein','min',0,'max',1),
        jsonb_build_object('name','Acompanhamentos','selection_type','multipla','role','side','min',0,'max',8),
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20)
      );
    when 'lanchonete' then
      _category_names := array['Lanches','Combos','Porções','Bebidas','Sobremesas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20),
        jsonb_build_object('name','Molhos','selection_type','multipla','role','sauce','min',0,'max',6),
        jsonb_build_object('name','Acompanhamentos','selection_type','multipla','role','side','min',0,'max',6)
      );
    when 'pastelaria' then
      _category_names := array['Pastéis','Combos','Porções','Bebidas'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Sabores','selection_type','multipla','role','flavor','min',1,'max',3),
        jsonb_build_object('name','Tamanho','selection_type','unica','role','size','min',0,'max',1),
        jsonb_build_object('name','Adicionais','selection_type','quantidade','role','generic','min',0,'max',20)
      );
    when 'adega' then
      _category_names := array['Cervejas','Refrigerantes','Destilados','Energéticos','Água e gelo','Combos e kits'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Volume','selection_type','unica','role','size','min',0,'max',1),
        jsonb_build_object('name','Embalagem','selection_type','unica','role','package','min',0,'max',1),
        jsonb_build_object('name','Complementos','selection_type','multipla','role','generic','min',0,'max',10)
      );
    when 'mercado' then
      _category_names := array['Padaria','Mercearia','Bebidas','Frios e laticínios','Doces e snacks','Higiene e limpeza'];
      _group_specs := jsonb_build_array(
        jsonb_build_object('name','Variações','selection_type','unica','role','variant','min',0,'max',1),
        jsonb_build_object('name','Complementos','selection_type','multipla','role','generic','min',0,'max',10)
      );
    else
      _category_names := array['Produtos','Bebidas'];
  end case;

  foreach _name in array _category_names loop
    if not exists (
      select 1 from public.categories c
      where c.store_id = _sid and not c.is_archived
        and public.normalize_label(c.name) = public.normalize_label(_name)
    ) then
      insert into public.categories(store_id,name,description,is_active,sort_order)
      values(
        _sid,
        _name,
        'Criada automaticamente pelo modelo ' || _profile.name || '.',
        true,
        coalesce((select max(c.sort_order)+1 from public.categories c where c.store_id=_sid and not c.is_archived),0)
      );
      _created_categories := _created_categories + 1;
    end if;
  end loop;

  for _spec in select value from jsonb_array_elements(_group_specs) loop
    if not exists (
      select 1 from public.option_groups og
      where og.store_id = _sid and not og.is_archived
        and public.normalize_label(og.name) = public.normalize_label(_spec->>'name')
    ) then
      insert into public.option_groups(
        store_id,name,description,selection_type,is_required,min_selections,max_selections,
        allow_quantity,pricing_strategy,price_effect,role,is_active,sort_order,configuration
      ) values (
        _sid,
        _spec->>'name',
        'Grupo inicial criado automaticamente. Edite as opções antes de vinculá-lo aos produtos.',
        (_spec->>'selection_type')::public.option_selection_type,
        coalesce((_spec->>'min')::int,0) > 0,
        coalesce((_spec->>'min')::int,0),
        greatest(coalesce((_spec->>'max')::int,1),1),
        (_spec->>'selection_type') = 'quantidade',
        'sum'::public.option_group_pricing_strategy,
        'additive'::public.option_group_price_effect,
        coalesce(_spec->>'role','generic'),
        true,
        coalesce((select max(og.sort_order)+1 from public.option_groups og where og.store_id=_sid and not og.is_archived),0),
        jsonb_build_object('starter_template',_profile.code)
      );
      _created_groups := _created_groups + 1;
    end if;
  end loop;

  perform private.log_config_audit(
    _sid,
    'catalog.starter_template.applied',
    'stores',
    _sid,
    array['category_profile_id','starter_categories','starter_option_groups']
  );

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object('id',_profile.id,'code',_profile.code,'name',_profile.name),
    'created_categories', _created_categories,
    'created_option_groups', _created_groups,
    'product_templates', _profile.product_templates
  );
end;
$function$;

revoke all on function public.apply_catalog_starter_template(uuid,text) from public;
grant execute on function public.apply_catalog_starter_template(uuid,text) to authenticated;
