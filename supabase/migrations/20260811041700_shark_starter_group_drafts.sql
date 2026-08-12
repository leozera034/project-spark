-- SHARK — grupos iniciais automáticos como rascunhos seguros.
-- A geração depende das capabilities do produto, nunca do nome da categoria.
-- Rascunhos começam inativos para não invalidar/publicar configuração incompleta.

create or replace function public.create_product_starter_group_drafts(
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
  _spec jsonb;
  _gid uuid;
  _link uuid;
  _created jsonb:='[]'::jsonb;
  _key text;
  _max integer;
  _min integer;
  _included integer;
  _required boolean;
  _selection public.option_selection_type;
  _portion integer;
begin
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);

  select * into _p
  from public.products
  where id=_product_id and store_id=_sid and not is_archived
  for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  -- Cada spec é uma primitiva reutilizável. Novas categorias só precisam habilitar
  -- capabilities no template do produto; não é necessário novo frontend.
  for _spec in
    select value from jsonb_array_elements(jsonb_build_array(
      case when coalesce((_p.capabilities->>'sizes')::boolean,false) then
        jsonb_build_object('key','size','name','Tamanho','role','size','required',true,'min',1,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'flavors')::boolean,false) then
        jsonb_build_object(
          'key','flavor','name','Sabores','role','flavor','required',true,'min',1,
          'max',case when coalesce((_p.capabilities->>'multi_flavor')::boolean,false) then 2 else 1 end,
          'selection',case when coalesce((_p.capabilities->>'multi_flavor')::boolean,false) then 'multipla' else 'unica' end,
          'portion_count',case when coalesce((_p.capabilities->>'multi_flavor')::boolean,false) then 2 else null end
        ) end,
      case when coalesce((_p.capabilities->>'dough')::boolean,false) then
        jsonb_build_object('key','dough','name','Massa','role','dough','required',true,'min',1,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'crust')::boolean,false) then
        jsonb_build_object('key','crust','name','Borda','role','crust','required',false,'min',0,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'creams')::boolean,false) then
        jsonb_build_object('key','cream','name','Cremes','role','cream','required',false,'min',0,'max',2,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'fruits')::boolean,false) then
        jsonb_build_object('key','fruit','name','Frutas','role','fruit','required',false,'min',0,'max',4,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'toppings')::boolean,false) then
        jsonb_build_object('key','topping','name','Complementos e coberturas','role','topping','required',false,'min',0,'max',8,'selection','multipla',
          'included',case when coalesce((_p.capabilities->>'included_choices')::boolean,false) then 4 else 0 end) end,
      case when coalesce((_p.capabilities->>'proteins')::boolean,false) then
        jsonb_build_object('key','protein','name','Proteína','role','protein','required',true,'min',1,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'sides')::boolean,false) then
        jsonb_build_object('key','side','name','Acompanhamentos','role','side','required',false,'min',0,'max',4,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'bread')::boolean,false) then
        jsonb_build_object('key','bread','name','Pão','role','bread','required',false,'min',0,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'doneness')::boolean,false) then
        jsonb_build_object('key','doneness','name','Ponto da carne','role','doneness','required',false,'min',0,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'sauces')::boolean,false) then
        jsonb_build_object('key','sauce','name','Molhos','role','sauce','required',false,'min',0,'max',3,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'containers')::boolean,false) then
        jsonb_build_object('key','container','name','Copo ou casquinha','role','container','required',true,'min',1,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'add_ons')::boolean,false) then
        jsonb_build_object('key','addon','name','Adicionais','role','addon','required',false,'min',0,'max',8,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'removals')::boolean,false) then
        jsonb_build_object('key','removal','name','Remover ingredientes','role','removal','required',false,'min',0,'max',8,'selection','multipla') end,
      case when coalesce((_p.capabilities->>'beverages')::boolean,false) and _p.product_type='combo' then
        jsonb_build_object('key','combo_beverage','name','Escolha sua bebida','role','combo_step','required',true,'min',1,'max',1,'selection','unica') end,
      case when coalesce((_p.capabilities->>'combo_steps')::boolean,false) then
        jsonb_build_object('key','combo_main','name','Escolha principal do combo','role','combo_step','required',true,'min',1,'max',1,'selection','unica') end
    )) value
    where value <> 'null'::jsonb
  loop
    _key:=_spec->>'key';

    -- Idempotência: o mesmo rascunho nunca é criado duas vezes para o produto.
    if exists (
      select 1
      from public.product_option_groups pog
      join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
      where pog.store_id=_sid and pog.product_id=_product_id and not pog.is_archived
        and og.configuration->>'shark_starter_key'=_key
    ) then
      continue;
    end if;

    _max:=greatest(1,coalesce((_spec->>'max')::integer,1));
    _min:=greatest(0,least(coalesce((_spec->>'min')::integer,0),_max));
    _included:=greatest(0,least(coalesce((_spec->>'included')::integer,0),_max));
    _required:=coalesce((_spec->>'required')::boolean,false);
    _selection:=coalesce(_spec->>'selection','multipla')::public.option_selection_type;
    _portion:=nullif(_spec->>'portion_count','')::integer;

    insert into public.option_groups(
      store_id,name,description,selection_type,is_required,min_selections,max_selections,
      allow_quantity,pricing_strategy,price_effect,portion_count,role,included_selections,
      configuration,is_active,sort_order
    ) values(
      _sid,private.clean_text(_spec->>'name'),'Rascunho sugerido pelo Shark. Edite e ative quando estiver pronto.',
      _selection,_required,_min,_max,_selection='quantidade','sum','additive',_portion,
      _spec->>'role',_included,
      jsonb_build_object('shark_starter_key',_key,'shark_draft',true,'generated_at',now()),
      false,coalesce((select max(sort_order)+1 from public.option_groups where store_id=_sid),0)
    ) returning id into _gid;

    insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,sort_order)
    values(
      _sid,_product_id,_gid,false,
      coalesce((select max(sort_order)+1 from public.product_option_groups where store_id=_sid and product_id=_product_id),0)
    ) returning id into _link;

    _created:=_created || jsonb_build_array(jsonb_build_object(
      'group_id',_gid,'link_id',_link,'key',_key,'name',_spec->>'name','role',_spec->>'role'
    ));
  end loop;

  perform private.log_config_audit(_sid,'catalog.product.starter_drafts.generated','products',_product_id,
    array['capabilities','option_groups']);

  return jsonb_build_object('created',_created,'created_count',jsonb_array_length(_created));
end;
$$;

grant execute on function public.create_product_starter_group_drafts(uuid,uuid) to authenticated;
revoke all on function public.create_product_starter_group_drafts(uuid,uuid) from anon;

comment on function public.create_product_starter_group_drafts(uuid,uuid) is
  'Cria grupos iniciais inativos e idempotentes a partir das capabilities do produto. Não publica configuração incompleta.';
