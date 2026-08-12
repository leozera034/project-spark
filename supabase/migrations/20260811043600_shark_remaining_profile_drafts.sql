-- SHARK — rascunhos complementares dos perfis restantes.
-- Opera por capabilities explícitas do produto e somente cria rascunhos inativos.

create or replace function public.ensure_remaining_experience_drafts(_store_id uuid,_product_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,private,pg_temp as $$
declare
  _sid uuid:=private.resolve_store(_store_id);
  _p public.products;
  _gid uuid;
  _link uuid;
  _created jsonb:='[]'::jsonb;
  _sort integer;

  procedure ensure_draft(_key text,_name text,_role text,_required boolean,_min integer,_max integer,_selection public.option_selection_type,_order integer) language plpgsql as $proc$
  begin
    if exists (
      select 1 from public.product_option_groups pog
      join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
      where pog.store_id=_sid and pog.product_id=_product_id and not pog.is_archived
        and og.configuration->>'shark_starter_key'=_key
    ) then return; end if;

    insert into public.option_groups(
      store_id,name,description,selection_type,is_required,min_selections,max_selections,
      allow_quantity,pricing_strategy,price_effect,role,included_selections,configuration,is_active,sort_order
    ) values(
      _sid,_name,'Rascunho sugerido pelo Shark. Edite e publique quando estiver pronto.',
      _selection,_required,_min,_max,_selection='quantidade','sum','additive',_role,0,
      jsonb_build_object('shark_starter_key',_key,'shark_draft',true,'experience_order',_order,'generated_at',now()),
      false,_order
    ) returning id into _gid;

    insert into public.product_option_groups(store_id,product_id,option_group_id,is_active,sort_order)
    values(_sid,_product_id,_gid,true,_order) returning id into _link;

    _created:=_created||jsonb_build_array(jsonb_build_object('group_id',_gid,'link_id',_link,'key',_key,'name',_name,'role',_role));
  end;
  $proc$;
begin
  perform private.require_permission('catalog.create',_sid);
  perform private.assert_product_editable(_sid,_product_id);
  select * into _p from public.products where id=_product_id and store_id=_sid and not is_archived for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  -- Sorveteria: quantidade de bolas é uma decisão própria; sabores/coberturas/recipiente já vêm do starter base.
  if coalesce((_p.capabilities->>'icecream_experience')::boolean,false) then
    if coalesce((_p.capabilities->>'portions')::boolean,false) then
      call ensure_draft('portion','Número de bolas','portion',true,1,1,'unica',15);
    end if;
  end if;

  -- Adega/bebidas: gelo é opcional. Volume/embalagem continuam nas variações do produto.
  if coalesce((_p.capabilities->>'beverage_experience')::boolean,false)
     and coalesce((_p.capabilities->>'ice')::boolean,false) then
    call ensure_draft('ice','Gelo','ice',false,0,2,'multipla',50);
  end if;

  -- Ordenação semântica apenas de rascunhos gerados automaticamente.
  for _gid,_sort in
    select og.id,
      case
        when coalesce((_p.capabilities->>'icecream_experience')::boolean,false) then case og.role
          when 'container' then 10 when 'portion' then 15 when 'flavor' then 20 when 'topping' then 30 when 'addon' then 40 else 90 end
        when coalesce((_p.capabilities->>'pastry_experience')::boolean,false) then case og.role
          when 'size' then 10 when 'flavor' then 20 when 'addon' then 30 when 'beverage' then 40 else 90 end
        when coalesce((_p.capabilities->>'beverage_experience')::boolean,false) then case og.role
          when 'flavor' then 20 when 'ice' then 50 when 'addon' then 60 else 90 end
        else og.sort_order
      end
    from public.product_option_groups pog
    join public.option_groups og on og.id=pog.option_group_id and og.store_id=pog.store_id
    where pog.store_id=_sid and pog.product_id=_product_id and not pog.is_archived
      and coalesce((og.configuration->>'shark_draft')::boolean,false)=true
  loop
    update public.option_groups set sort_order=_sort,configuration=configuration||jsonb_build_object('experience_order',_sort),updated_at=now()
    where id=_gid and store_id=_sid;
    update public.product_option_groups set sort_order=_sort,updated_at=now()
    where store_id=_sid and product_id=_product_id and option_group_id=_gid;
  end loop;

  return jsonb_build_object('created',_created,'created_count',jsonb_array_length(_created));
end;
$$;

grant execute on function public.ensure_remaining_experience_drafts(uuid,uuid) to authenticated;
revoke all on function public.ensure_remaining_experience_drafts(uuid,uuid) from anon;
